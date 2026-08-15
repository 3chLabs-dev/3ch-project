const express = require("express");
const crypto = require("crypto");
const pool = require("../db/pool");
const { requireAuth, requireAdmin } = require("../middlewares/auth");
const { provisionSubscriptionCredits } = require("../services/featureUsageService");
const router = express.Router();
const TYPES = new Set(["FREE_MONTHS", "PERCENT_DISCOUNT", "LEAGUE_CREATE", "VISION_SCAN", "DRAW_CREATE"]);
const FEATURES = { LEAGUE_CREATE: "LEAGUE_CREATE", VISION_SCAN: "VISION_SCAN", DRAW_CREATE: "DRAW_CREATE" };
const ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

function generateCode() {
  const bytes = crypto.randomBytes(16); let raw = "";
  for (let i=0;i<16;i+=1) raw += ALPHABET[bytes[i] % ALPHABET.length];
  return `${raw.slice(0,4)}-${raw.slice(4,8)}-${raw.slice(8,12)}-${raw.slice(12)}`;
}
function normalizeCode(value) {
  return String(value || "").normalize("NFKC").trim().toUpperCase().replace(/[\s-]+/g, "");
}
function couponError(status, code, message) { return Object.assign(new Error(message), { status, couponCode: code }); }

router.post("/coupons/redeem", requireAuth, async (req, res) => {
  const userId = Number(req.user.sub); const code = normalizeCode(req.body?.code);
  if (!code) return res.status(400).json({ ok:false,error:"COUPON_CODE_REQUIRED" });
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const found = await client.query(`SELECT * FROM coupons WHERE normalized_code=$1 FOR UPDATE`, [code]);
    if (!found.rowCount) throw couponError(404,"COUPON_NOT_FOUND","존재하지 않는 쿠폰입니다.");
    const coupon=found.rows[0], now=Date.now();
    if (!coupon.is_active) throw couponError(400,"COUPON_INACTIVE","사용이 중지된 쿠폰입니다.");
    if (now < +new Date(coupon.valid_from) || now >= +new Date(coupon.valid_until)) throw couponError(400,"COUPON_EXPIRED","쿠폰 사용기간이 아닙니다.");
    if ((await client.query(`SELECT 1 FROM coupon_redemptions WHERE coupon_id=$1 AND user_id=$2`,[coupon.id,userId])).rowCount) throw couponError(409,"COUPON_ALREADY_USED","이미 등록한 쿠폰입니다.");
    const redemptionCount=Number((await client.query(`SELECT COUNT(*)::int AS count FROM coupon_redemptions WHERE coupon_id=$1`,[coupon.id])).rows[0].count);
    if (coupon.distribution_type === "SINGLE" && redemptionCount > 0) throw couponError(409,"COUPON_ALREADY_USED","이미 사용된 쿠폰입니다.");
    if (coupon.max_redemptions !== null && redemptionCount >= coupon.max_redemptions) throw couponError(409,"COUPON_LIMIT_REACHED","쿠폰 사용 인원이 마감되었습니다.");
    let benefit;
    if (FEATURES[coupon.type]) {
      await client.query(`INSERT INTO feature_credit_buckets (user_id,feature,source,initial_amount,remaining_amount,starts_at,expires_at,source_ref)
        VALUES ($1,$2,'COUPON',$3,$3,NOW(),$4,$5)`,[userId,FEATURES[coupon.type],coupon.value,coupon.valid_until,`coupon:${coupon.id}:${userId}`]);
      benefit={feature:FEATURES[coupon.type],count:coupon.value,expiresAt:coupon.valid_until};
    } else if (coupon.type === "FREE_MONTHS") {
      const active=await client.query(`SELECT id,plan,expires_at FROM subscriptions WHERE user_id=$1 AND status='ACTIVE' AND expires_at>NOW() ORDER BY expires_at DESC LIMIT 1 FOR UPDATE`,[userId]);
      const plan=coupon.plan_code || active.rows[0]?.plan || "basic"; const expiresAt=new Date(active.rows[0]?.expires_at || Date.now());
      expiresAt.setUTCMonth(expiresAt.getUTCMonth()+coupon.value);
      const inserted=await client.query(`INSERT INTO subscriptions (user_id,plan,order_id,payment_key,amount,expires_at,is_recurring)
        VALUES ($1,$2,$3,'COUPON',0,$4,false) RETURNING id,started_at`,[userId,plan,`COUPON_${coupon.id}_${userId}`,expiresAt]);
      if (active.rowCount) await client.query(`UPDATE subscriptions SET status='EXPIRED' WHERE id=$1`,[active.rows[0].id]);
      await provisionSubscriptionCredits(client,{subscriptionId:inserted.rows[0].id,userId,plan,startsAt:inserted.rows[0].started_at,expiresAt});
      benefit={plan,months:coupon.value,expiresAt};
    } else benefit={percent:coupon.value,planCode:coupon.plan_code || null,remainingMonths:coupon.duration_months || 1,totalMonths:coupon.duration_months || 1};
    const available=coupon.type === "PERCENT_DISCOUNT";
    await client.query(`INSERT INTO coupon_redemptions (coupon_id,user_id,status,benefit,applied_at) VALUES ($1,$2,$3,$4::jsonb,$5)`,
      [coupon.id,userId,available?"AVAILABLE":"APPLIED",JSON.stringify(benefit),available?null:new Date()]);
    await client.query("COMMIT"); return res.json({ok:true,coupon:{name:coupon.name,type:coupon.type,value:coupon.value},benefit});
  } catch(e) { await client.query("ROLLBACK"); return res.status(e.status||500).json({ok:false,error:e.couponCode||"COUPON_REDEEM_FAILED",message:e.message}); }
  finally { client.release(); }
});

router.get("/coupons/me",requireAuth,async(req,res)=>{ const result=await pool.query(`SELECT c.name,c.type,c.value,c.plan_code,c.valid_until,r.status,r.benefit,r.redeemed_at,r.applied_at FROM coupon_redemptions r JOIN coupons c ON c.id=r.coupon_id WHERE r.user_id=$1 ORDER BY r.redeemed_at DESC`,[Number(req.user.sub)]); res.json({ok:true,coupons:result.rows}); });

router.get("/admin/coupons",requireAdmin,async(req,res)=>{ const search=String(req.query.search||"").trim(); const result=await pool.query(`SELECT c.*,COALESCE((SELECT COUNT(*)::int FROM coupon_redemptions cr WHERE cr.coupon_id=c.id),0) AS redemption_count,COALESCE((SELECT jsonb_agg(jsonb_build_object('id',u.id,'name',COALESCE(u.name,u.nickname),'email',u.email,'redeemed_at',r.redeemed_at,'status',r.status,'clubs',COALESCE((SELECT jsonb_agg(jsonb_build_object('id',g.id,'name',g.name)) FROM group_members gm JOIN groups g ON g.id=gm.group_id WHERE gm.user_id=u.id AND gm.role='owner'),'[]'::jsonb)) ORDER BY r.redeemed_at DESC) FROM coupon_redemptions r JOIN users u ON u.id=r.user_id WHERE r.coupon_id=c.id),'[]'::jsonb) AS redemptions FROM coupons c WHERE ($1='' OR c.code ILIKE '%'||$1||'%' OR c.name ILIKE '%'||$1||'%' OR EXISTS(SELECT 1 FROM coupon_redemptions r JOIN users u ON u.id=r.user_id WHERE r.coupon_id=c.id AND u.email ILIKE '%'||$1||'%')) ORDER BY c.created_at DESC LIMIT 500`,[search]); res.json({ok:true,coupons:result.rows}); });

router.post("/admin/coupons",requireAdmin,async(req,res)=>{ const {name,type,value,planCode,durationMonths,validFrom,validUntil,quantity=1,distributionType="SINGLE",customCode,maxRedemptions}=req.body||{}; const isOpen=distributionType==="OPEN"; const count=isOpen?1:Math.min(100,Math.max(1,Number(quantity)||1));
  if(!name||!TYPES.has(type)||!Number.isInteger(Number(value))||Number(value)<1||!validUntil||new Date(validUntil)<=new Date(validFrom||Date.now())||(type==="PERCENT_DISCOUNT"&&Number(value)>99)||(["FREE_MONTHS","PERCENT_DISCOUNT"].includes(type)&&!planCode)||(type==="PERCENT_DISCOUNT"&&(!Number.isInteger(Number(durationMonths))||Number(durationMonths)<1))||(isOpen&&!normalizeCode(customCode))||(maxRedemptions!==null&&maxRedemptions!==undefined&&maxRedemptions!==""&&Number(maxRedemptions)<1)) return res.status(400).json({ok:false,error:"INVALID_COUPON"});
  const client=await pool.connect(); try { await client.query("BEGIN"); const rows=[]; for(let i=0;i<count;i+=1){ let inserted; for(let retry=0;retry<5;retry+=1){ try { const displayCode=isOpen?String(customCode).normalize("NFKC").trim():generateCode(); inserted=await client.query(`INSERT INTO coupons (code,normalized_code,distribution_type,max_redemptions,name,type,value,plan_code,duration_months,valid_from,valid_until,created_by_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,[displayCode,normalizeCode(displayCode),isOpen?"OPEN":"SINGLE",isOpen&&maxRedemptions!==""&&maxRedemptions!=null?Number(maxRedemptions):null,String(name).trim(),type,Number(value),planCode||null,type==="PERCENT_DISCOUNT"?Number(durationMonths):type==="FREE_MONTHS"?Number(value):null,validFrom||new Date(),validUntil,Number(req.user.sub)]); break; } catch(e){if(e.code!=="23505")throw e;} } if(!inserted)throw new Error("쿠폰번호가 이미 존재하거나 생성에 실패했습니다."); rows.push(inserted.rows[0]); } await client.query("COMMIT"); res.status(201).json({ok:true,coupons:rows}); } catch(e){await client.query("ROLLBACK");res.status(e.code==="23505"?409:500).json({ok:false,error:e.code==="23505"?"DUPLICATE_CODE":"CREATE_FAILED",message:e.message});} finally{client.release();} });

router.patch("/admin/coupons/:id",requireAdmin,async(req,res)=>{const {name,value,planCode,validFrom,validUntil,isActive}=req.body||{}; const used=await pool.query(`SELECT 1 FROM coupon_redemptions WHERE coupon_id=$1`,[req.params.id]); const contentChange=[name,value,planCode,validFrom,validUntil].some(v=>v!==undefined); if(used.rowCount&&contentChange)return res.status(409).json({ok:false,error:"USED_COUPON_IMMUTABLE"}); const result=await pool.query(`UPDATE coupons SET name=COALESCE($2,name),value=COALESCE($3,value),plan_code=COALESCE($4,plan_code),valid_from=COALESCE($5,valid_from),valid_until=COALESCE($6,valid_until),is_active=COALESCE($7,is_active),updated_at=NOW() WHERE id=$1 RETURNING *`,[req.params.id,name||null,value?Number(value):null,planCode||null,validFrom||null,validUntil||null,isActive]); res.status(result.rowCount?200:404).json(result.rowCount?{ok:true,coupon:result.rows[0]}:{ok:false,error:"NOT_FOUND"});});
router.delete("/admin/coupons/:id",requireAdmin,async(req,res)=>{const used=await pool.query(`SELECT 1 FROM coupon_redemptions WHERE coupon_id=$1`,[req.params.id]); const result=used.rowCount?await pool.query(`UPDATE coupons SET is_active=false,updated_at=NOW() WHERE id=$1 RETURNING id`,[req.params.id]):await pool.query(`DELETE FROM coupons WHERE id=$1 RETURNING id`,[req.params.id]); res.status(result.rowCount?200:404).json(result.rowCount?{ok:true,archived:Boolean(used.rowCount)}:{ok:false,error:"NOT_FOUND"});});
module.exports=router;
