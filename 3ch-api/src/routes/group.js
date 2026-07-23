const express = require('express');
const { z } = require('zod');
const { randomUUID } = require('crypto');
const pool = require('../db/pool');
const { requireAuth } = require('../middlewares/auth');
const { requireGroupAdmin, requireGroupOwner } = require('../middlewares/permissions');
const { generateClubCode } = require('../utils/clubCodeUtils');
const {
  rebuildGroupRanking,
  getGroupRanking,
  getGroupRankingDetail,
  updateGroupRankingSettings,
} = require('../services/groupRanking');
const { getPointRanking } = require('../services/pointRanking');

const router = express.Router();

// club_code(AAA 형식)로 요청 시 실제 UUID로 자동 변환
router.param('id', async (req, _res, next, id) => {
  if (/^[A-Z]{3}$/.test(id)) {
    try {
      const result = await pool.query('SELECT id FROM groups WHERE club_code = $1', [id]);
      if (result.rows.length > 0) {
        req.params.id = result.rows[0].id;
      }
    } catch (e) {
      // 변환 실패 시 원본 id 유지
    }
  }
  next();
});

/**
 * @openapi
 * tags:
 *   name: 클럽
 *   description: 클럽 관리 API - 클럽 생성, 가입, 멤버 관리 등
 */

/**
 * @openapi
 * components:
 *   schemas:
 *     Group:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         name:
 *           type: string
 *         description:
 *           type: string
 *           nullable: true
 *         sport:
 *           type: string
 *           nullable: true
 *         type:
 *           type: string
 *           nullable: true
 *         region_city:
 *           type: string
 *           nullable: true
 *         region_district:
 *           type: string
 *           nullable: true
 *         address:
 *           type: string
 *           nullable: true
 *         lat:
 *           type: number
 *           nullable: true
 *         lng:
 *           type: number
 *           nullable: true
 *         member_count:
 *           type: integer
 *         role:
 *           type: string
 *           enum: [owner, admin, member]
 *         created_at:
 *           type: string
 *           format: date-time
 *     GroupMember:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *         user_id:
 *           type: integer
 *         name:
 *           type: string
 *           nullable: true
 *         email:
 *           type: string
 *         role:
 *           type: string
 *           enum: [owner, admin, member]
 *         division:
 *           type: string
 *           nullable: true
 *         joined_at:
 *           type: string
 *           format: date-time
 *     RecommendedClub:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *         name:
 *           type: string
 *         sport:
 *           type: string
 *           nullable: true
 *         region_city:
 *           type: string
 *           nullable: true
 *         region_district:
 *           type: string
 *           nullable: true
 *         member_count:
 *           type: integer
 *         distance_km:
 *           type: number
 */

const createGroupSchema = z.object({
  name: z.string().min(1, '클럽 이름은 필수입니다'),
  description: z.string().optional(),
  sport: z.string().optional(),
  region_city: z.string().optional(),
  region_district: z.string().optional(),
  founded_at: z.string().optional(),
  address: z.string().optional(),
  address_detail: z.string().optional(),
  lat: z.number().optional(),
  lng: z.number().optional(),
  links: z
    .array(
      z.object({
        label: z.string().optional(),
        url: z.string().url(),
        sort_order: z.number().int().optional(),
      })
    ).optional(),
});

const rankingSettingsSchema = z.object({
  enabled: z.boolean().optional(),
  base_rating: z.number().int().min(500).max(4000).optional(),
  k_league: z.number().int().min(1).max(128).optional(),
  k_tournament: z.number().int().min(1).max(128).optional(),
  include_tournament: z.boolean().optional(),
});

/**
 * @openapi
 * /group/check-name:
 *   get:
 *     summary: 클럽명 중복 검사
 *     description: 클럽 생성 시 클럽명이 이미 사용 중인지 확인합니다.
 *     tags: [클럽]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: name
 *         required: true
 *         schema:
 *           type: string
 *         description: 확인할 클럽명
 *     responses:
 *       200:
 *         description: 중복 검사 결과
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 available:
 *                   type: boolean
 *                   description: 사용 가능 여부
 *       400:
 *         description: 클럽명이 제공되지 않음
 *       500:
 *         description: 서버 오류
 */
router.get('/group/check-name', requireAuth, async (req, res) => {
  try {
    const { name } = req.query;
    if (!name || !name.trim()) {
      return res.status(400).json({ message: '클럽명을 입력해주세요' });
    }

    const result = await pool.query(
      `SELECT id FROM groups WHERE name = $1`,
      [name.trim()]
    );

    const available = result.rows.length === 0;
    res.status(200).json({ available });
  } catch (error) {
    console.error('Error checking group name:', error);
    res.status(500).json({ message: '내부 서버 오류' });
  }
});

/**
 * @openapi
 * /group:
 *   post:
 *     summary: 클럽 생성
 *     description: 새로운 클럽을 생성합니다. 생성자는 자동으로 owner 역할을 부여받습니다.
 *     tags: [클럽]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *                 description: 클럽명
 *               description:
 *                 type: string
 *                 description: 클럽 설명
 *               sport:
 *                 type: string
 *                 description: 종목 (예 탁구, 배드민턴, 테니스)
 *               type:
 *                 type: string
 *                 description: 종류 (예 동호회, 학교, 직장, 지역)
 *               region_city:
 *                 type: string
 *                 description: 지역(시/도)
 *               region_district:
 *                 type: string
 *                 description: 지역(구/군)
 *               founded_at:
 *                 type: string
 *                 format: date
 *                 description: 창립일
 *     responses:
 *       201:
 *         description: 클럽 생성 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 group:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     name:
 *                       type: string
 *       400:
 *         description: 유효하지 않은 요청
 *       409:
 *         description: 이미 사용 중인 클럽명
 *       500:
 *         description: 서버 오류
 */
router.post('/group', requireAuth, async (req, res) => {
  const client = await pool.connect();
  try {
    const { name, description, sport, region_city, region_district, founded_at, address, address_detail, lat, lng, links = [], } = createGroupSchema.parse(req.body);
    const userId = req.user.sub;
    const groupId = randomUUID();
    const memberId = randomUUID();

    await client.query('BEGIN');

    await client.query(
      `INSERT INTO groups (id, name, description, sport, region_city, region_district, founded_at, address, address_detail, lat, lng, created_by_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [groupId, name, description || null, sport || null, region_city || null, region_district || null, founded_at || null, address || null, address_detail || null, lat ?? null, lng ?? null, userId]
    );

    for ( const [index, link] of links.entries() ) {
      await client.query(
        `INSERT INTO group_links (id, group_id, label, url, sort_order)
        VALUES ($1, $2, $3, $4, $5)`,
        [ randomUUID(), groupId, link.label || null, link.url, link.sort_order ?? index + 1, ]
      );
    }

    await client.query(
      `INSERT INTO group_members (id, group_id, user_id, role)
       VALUES ($1, $2, $3, 'owner')`,
      [memberId, groupId, userId]
    );

    const clubCode = await generateClubCode(client);
    await client.query(`UPDATE groups SET club_code = $1 WHERE id = $2`, [clubCode, groupId]);

    await client.query('COMMIT');

    res.status(201).json({
      message: '클럽이 성공적으로 생성되었습니다',
      group: { id: groupId, name },
    });
  } catch (error) {
    await client.query('ROLLBACK');
    if (error instanceof z.ZodError) {
      return res.status(400).json({ errors: error.errors });
    }
    if (error.code === '23505') {
      return res.status(409).json({ message: '이미 사용 중인 클럽명입니다' });
    }
    console.error('Error creating group:', error);
    res.status(500).json({ message: '내부 서버 오류' });
  } finally {
    client.release();
  }
});

/**
 * @openapi
 * /group/search:
 *   get:
 *     summary: 클럽 검색 및 추천
 *     description: 내가 가입하지 않은 클럽을 검색하거나 추천받습니다.
 *     tags: [클럽]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: q
 *         schema:
 *           type: string
 *         description: 검색어 (클럽명)
 *       - in: query
 *         name: region_city
 *         schema:
 *           type: string
 *         description: 지역 필터 (시/도)
 *       - in: query
 *         name: region_district
 *         schema:
 *           type: string
 *         description: 지역 필터 (구/군)
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *           maximum: 50
 *         description: 결과 개수 제한
 *       - in: query
 *         name: sort_by_region
 *         schema:
 *           type: boolean
 *         description: true일 때 region_city를 필터가 아닌 정렬 기준으로 사용 (같은 지역 우선, 다른 지역도 표시)
 *     responses:
 *       200:
 *         description: 검색 결과
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 groups:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       name:
 *                         type: string
 *                       description:
 *                         type: string
 *                       region_city:
 *                         type: string
 *                       region_district:
 *                         type: string
 *                       created_at:
 *                         type: string
 *                         format: date-time
 *                       member_count:
 *                         type: integer
 *       500:
 *         description: 서버 오류
 */
router.get('/group/search', requireAuth, async (req, res) => {
  try {
    const userId = req.user.sub;
    const { q, region_city, region_district, limit = '20', sort_by_region, include_joined } = req.query;

    const conditions = [];
    const params = [];
    let paramIdx = 1;

    // 일반 클럽 검색에서는 가입한 클럽을 제외하지만, 리그 초대 검색에서는 포함할 수 있다.
    if (include_joined !== 'true') {
      conditions.push(`g.id NOT IN (SELECT group_id FROM group_members WHERE user_id = $${paramIdx})`);
      params.push(userId);
      paramIdx++;
    }

    // 검색어가 있으면 필터링
    if (q && q.trim()) {
      conditions.push(`g.name ILIKE $${paramIdx}`);
      params.push(`%${q.trim()}%`);
      paramIdx++;
    }

    // sort_by_region=true이면 지역은 정렬 기준으로만 사용 (필터링 X)
    // sort_by_region=false이거나 없으면 지역 필터링
    const useSortOnly = sort_by_region === 'true';

    if (!useSortOnly) {
      if (region_city && region_city.trim()) {
        conditions.push(`g.region_city = $${paramIdx}`);
        params.push(region_city.trim());
        paramIdx++;
      }

      if (region_district && region_district.trim()) {
        conditions.push(`g.region_district = $${paramIdx}`);
        params.push(region_district.trim());
        paramIdx++;
      }
    }

    params.push(Math.min(parseInt(limit, 10) || 20, 50));

    // 정렬: region_city가 제공되고 sort_by_region=true이면 일치하는 것 우선
    let orderBy = 'g.created_at DESC';
    if (useSortOnly && region_city && region_city.trim()) {
      orderBy = `(CASE WHEN g.region_city = '${region_city.trim()}' THEN 0 ELSE 1 END), g.created_at DESC`;
    }

    const result = await pool.query(
      `SELECT g.id, g.name, g.description, g.sport, g.region_city, g.region_district, g.created_at,
              (SELECT COUNT(*) FROM group_members WHERE group_id = g.id)::int AS member_count
       FROM groups g
       ${conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''}
       ORDER BY ${orderBy}
       LIMIT $${paramIdx}`,
      params
    );

    res.status(200).json({ groups: result.rows });
  } catch (error) {
    console.error('Error searching groups:', error);
    res.status(500).json({ message: '내부 서버 오류' });
  }
});

/**
 * @openapi
 * /group:
 *   get:
 *     summary: 내가 속한 클럽 목록 조회
 *     description: 로그인한 사용자가 가입한 모든 클럽 목록을 반환합니다.
 *     tags: [클럽]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 클럽 목록
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 groups:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       name:
 *                         type: string
 *                       description:
 *                         type: string
 *                       region_city:
 *                         type: string
 *                       region_district:
 *                         type: string
 *                       created_at:
 *                         type: string
 *                         format: date-time
 *                       role:
 *                         type: string
 *                         enum: [owner, admin, member]
 *                       creator_name:
 *                         type: string
 *                       member_count:
 *                         type: integer
 *       500:
 *         description: 서버 오류
 */
router.get('/group', requireAuth, async (req, res) => {
  try {
    const userId = req.user.sub;

    const result = await pool.query(
      `SELECT g.id, g.name, g.description, g.sport, g.region_city, g.region_district, g.created_at,
              g.club_code, gm.role, gm.division,
              u.name AS creator_name,
              (SELECT COUNT(*) FROM group_members WHERE group_id = g.id)::int AS member_count
       FROM groups g
       INNER JOIN group_members gm ON gm.group_id = g.id AND gm.user_id = $1
       LEFT JOIN users u ON g.created_by_id = u.id
       ORDER BY g.created_at DESC`,
      [userId]
    );

    res.status(200).json({ groups: result.rows });
  } catch (error) {
    console.error('Error fetching groups:', error);
    res.status(500).json({ message: '내부 서버 오류' });
  }
});

/**
 * @openapi
 * /group/{id}:
 *   get:
 *     summary: 클럽 상세 정보 조회
 *     description: 특정 클럽의 상세 정보와 멤버 목록을 조회합니다. 클럽에 속한 사용자만 접근 가능합니다.
 *     tags: [클럽]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: 클럽 ID
 *     responses:
 *       200:
 *         description: 클럽 상세 정보
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 group:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                     name:
 *                       type: string
 *                     description:
 *                       type: string
 *                     created_at:
 *                       type: string
 *                       format: date-time
 *                     creator_name:
 *                       type: string
 *                 members:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       role:
 *                         type: string
 *                         enum: [owner, admin, member]
 *                       joined_at:
 *                         type: string
 *                         format: date-time
 *                       user_id:
 *                         type: integer
 *                       name:
 *                         type: string
 *                       email:
 *                         type: string
 *                 myRole:
 *                   type: string
 *                   enum: [owner, admin, member]
 *       403:
 *         description: 클럽에 속해있지 않음
 *       404:
 *         description: 클럽을 찾을 수 없음
 *       500:
 *         description: 서버 오류
 */
/**
 * @openapi
 * /group/geocode:
 *   get:
 *     summary: 주소를 좌표로 변환 (Geocoding)
 *     description: Kakao 주소 검색 API를 이용해 주소 문자열을 위도/경도 좌표로 변환합니다. /group/:id 보다 먼저 등록되어야 합니다.
 *     tags: [클럽]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: address
 *         required: true
 *         schema:
 *           type: string
 *         description: 변환할 주소 문자열
 *         example: 서울특별시 강남구 테헤란로 427
 *     responses:
 *       200:
 *         description: 좌표 변환 성공 또는 주소를 찾을 수 없음
 *         content:
 *           application/json:
 *             schema:
 *               oneOf:
 *                 - type: object
 *                   description: 변환 성공
 *                   properties:
 *                     ok:
 *                       type: boolean
 *                       example: true
 *                     lat:
 *                       type: number
 *                       format: float
 *                       description: 위도
 *                       example: 37.5665
 *                     lng:
 *                       type: number
 *                       format: float
 *                       description: 경도
 *                       example: 126.9780
 *                 - type: object
 *                   description: 주소를 찾을 수 없음
 *                   properties:
 *                     ok:
 *                       type: boolean
 *                       example: false
 *                     error:
 *                       type: string
 *                       example: NOT_FOUND
 *       400:
 *         description: address 파라미터 누락
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: string
 *                   example: ADDRESS_REQUIRED
 *       401:
 *         description: 인증 필요
 *       500:
 *         description: Kakao API 키 미설정 또는 서버 오류
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: string
 *                   example: KAKAO_KEY_NOT_SET
 */
// 주소 → 좌표 변환 (Kakao 주소 검색 API) - /group/:id 보다 먼저 등록해야 함
router.get('/group/geocode', requireAuth, async (req, res) => {
  try {
    const { address } = req.query;
    if (!address || !address.trim()) {
      return res.status(400).json({ ok: false, error: 'ADDRESS_REQUIRED' });
    }

    const key = process.env.KAKAO_REST_API_KEY;
    if (!key) {
      return res.status(500).json({ ok: false, error: 'KAKAO_KEY_NOT_SET' });
    }

    const url = `https://dapi.kakao.com/v2/local/search/address.json?query=${encodeURIComponent(address.trim())}`;
    const r = await fetch(url, { headers: { Authorization: `KakaoAK ${key}` } });
    const data = await r.json();

    const doc = data.documents?.[0];
    if (!doc) {
      return res.json({ ok: false, error: 'NOT_FOUND' });
    }

    return res.json({ ok: true, lat: parseFloat(doc.y), lng: parseFloat(doc.x) });
  } catch (e) {
    console.error('Geocode error:', e);
    return res.status(500).json({ ok: false, error: String(e.message || e) });
  }
});

/**
 * @openapi
 * /group/recommend:
 *   post:
 *     summary: 주변 클럽 GPS 추천
 *     description: 현재 위치 기준 Haversine 공식으로 가장 가까운 클럽 최대 8개를 반환합니다. 이미 가입한 클럽은 제외됩니다.
 *     tags: [클럽]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [lat, lng]
 *             properties:
 *               lat:
 *                 type: number
 *                 description: 위도
 *               lng:
 *                 type: number
 *                 description: 경도
 *               sport:
 *                 type: string
 *                 description: 종목 필터 (선택)
 *     responses:
 *       200:
 *         description: 주변 클럽 목록
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 ok:
 *                   type: boolean
 *                 clubs:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       name:
 *                         type: string
 *                       sport:
 *                         type: string
 *                       region_city:
 *                         type: string
 *                       region_district:
 *                         type: string
 *                       member_count:
 *                         type: integer
 *                       distance_km:
 *                         type: number
 *       400:
 *         description: lat/lng 누락
 *       500:
 *         description: 서버 오류
 */
// GPS 기반 AI 클럽 추천
router.post('/group/recommend', requireAuth, async (req, res) => {
  try {
    const userId = req.user.sub;
    const { lat, lng, sport } = req.body;

    if (lat === undefined || lng === undefined) {
      return res.status(400).json({ ok: false, error: 'LAT_LNG_REQUIRED' });
    }

    // Kakao 역지오코딩으로 사용자 시/군/구 조회 (region_city 폴백용)
    let userCity = null;
    const kakaoKey = process.env.KAKAO_REST_API_KEY;
    if (kakaoKey) {
      try {
        const geoUrl = `https://dapi.kakao.com/v2/local/geo/coord2regioncode.json?x=${lng}&y=${lat}`;
        const geoRes = await fetch(geoUrl, { headers: { Authorization: `KakaoAK ${kakaoKey}` } });
        const geoData = await geoRes.json();
        const region = geoData.documents?.find((d) => d.region_type === 'B');
        userCity = region?.region_2depth_name?.split(' ')[0] || null;
      } catch {
        // Kakao 실패 시 GPS 좌표 기반만으로 진행
      }
    }

    // GPS 좌표 기반 + region_city/region_district 폴백
    // - region_city = "안양시" 로 저장된 클럽: region_city = $4 매칭
    // - region_city = "경기도", region_district = "안양시" 로 저장된 클럽: region_district = $4 매칭
    const params = [lat, lng, userId, userCity];
    let paramIdx = 5;
    let sportCondition = '';
    if (sport) {
      sportCondition = `AND g.sport = $${paramIdx++}`;
      params.push(sport);
    }

    const { rows: clubs } = await pool.query(
      `SELECT g.id, g.name, g.sport, g.region_city, g.region_district, g.address,
              (SELECT COUNT(*)::int FROM group_members WHERE group_id = g.id) AS member_count,
              CASE
                WHEN g.lat IS NOT NULL AND g.lng IS NOT NULL THEN
                  6371 * acos(
                    LEAST(1, cos(radians($1)) * cos(radians(g.lat)) * cos(radians(g.lng) - radians($2))
                           + sin(radians($1)) * sin(radians(g.lat)))
                  )
                ELSE NULL
              END AS distance_km
       FROM groups g
       WHERE g.id NOT IN (SELECT group_id FROM group_members WHERE user_id = $3)
         AND (
           (g.lat IS NOT NULL AND g.lng IS NOT NULL)
           OR ($4::text IS NOT NULL AND g.region_city = $4)
           OR ($4::text IS NOT NULL AND g.region_district = $4)
         )
         ${sportCondition}
       ORDER BY distance_km ASC NULLS LAST
       LIMIT 8`,
      params
    );

    return res.json({ ok: true, clubs, message: null });
  } catch (e) {
    console.error('Recommend error:', e);
    return res.status(500).json({ ok: false, error: String(e.message || e) });
  }
});

/**
 * @openapi
 * /group/{id}:
 *   get:
 *     summary: 클럽 상세 조회
 *     description: 클럽 정보와 멤버 목록을 반환합니다. 해당 클럽 멤버만 조회 가능합니다.
 *     tags: [클럽]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: 클럽 ID
 *     responses:
 *       200:
 *         description: 클럽 상세 정보
 *       403:
 *         description: 클럽 멤버가 아님
 *       404:
 *         description: 클럽을 찾을 수 없음
 *       500:
 *         description: 서버 오류
 */
router.get('/group/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.sub;

    // 해당 클럽에 속해있는지 확인 (없어도 기본 정보는 반환)
    const memberCheck = await pool.query(
      `SELECT role FROM group_members WHERE group_id = $1 AND user_id = $2`,
      [id, userId]
    );
    const myRole = memberCheck.rows.length > 0 ? memberCheck.rows[0].role : null;

    const groupResult = await pool.query(
      `SELECT g.id, g.name, g.description, g.sport, g.region_city, g.region_district,
              g.founded_at, g.address, g.address_detail, g.lat, g.lng, g.created_at,
              g.club_code, u.name AS creator_name
       FROM groups g
       LEFT JOIN users u ON g.created_by_id = u.id
       WHERE g.id = $1`,
      [id]
    );

    const linksResult = await pool.query(
      `SELECT id, label, url, sort_order
      FROM group_links
      WHERE group_id = $1
      ORDER BY sort_order ASC, created_at ASC`,
      [id]
    );

    if (groupResult.rows.length === 0) {
      return res.status(404).json({ message: '클럽을 찾을 수 없습니다' });
    }

    // 멤버 목록 조회 (비가입자는 이메일 제외)
    const membersQuery = myRole
      ? `SELECT gm.id, gm.role, gm.division, gm.joined_at, u.id AS user_id, u.name, u.email
         FROM group_members gm
         INNER JOIN users u ON gm.user_id = u.id
         WHERE gm.group_id = $1
         ORDER BY CASE gm.role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END, gm.joined_at ASC`
      : `SELECT gm.id, gm.role, gm.division, gm.joined_at, u.id AS user_id, u.name
         FROM group_members gm
         INNER JOIN users u ON gm.user_id = u.id
         WHERE gm.group_id = $1
         ORDER BY CASE gm.role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END, gm.joined_at ASC`;
    const membersResult = await pool.query(membersQuery, [id]);
    const members = membersResult.rows;

    res.status(200).json({
      group: groupResult.rows[0],
      links: linksResult.rows,
      members,
      myRole,
    });
  } catch (error) {
    console.error('Error fetching group:', error);
    res.status(500).json({ message: '내부 서버 오류' });
  }
});

const rankingSeasonSchema = z.object({
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  auto_renew: z.boolean().optional().default(false),
}).refine((value) => value.end_date >= value.start_date, {
  message: '종료일은 시작일보다 빠를 수 없습니다.',
  path: ['end_date'],
});

// 수동 등록된 클럽 회원과 회원 전환 신청 목록
router.get('/group/:id/pre-members', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = Number(req.user.sub);
    const roleResult = await pool.query(
      `SELECT role FROM group_members WHERE group_id = $1 AND user_id = $2`,
      [id, userId]
    );
    const myRole = roleResult.rows[0]?.role || null;
    const canManage = myRole === 'owner' || myRole === 'admin';
    const result = await pool.query(
      `SELECT pm.id, pm.name, pm.division, pm.status, pm.created_at,
              c.id AS claim_id, c.status AS claim_status, c.requested_by_id,
              c.requested_at, u.name AS requester_name
       FROM group_pre_members pm
       LEFT JOIN group_member_claims c ON c.pre_member_id = pm.id
       LEFT JOIN users u ON u.id = c.requested_by_id
       WHERE pm.group_id = $1
         AND pm.status <> 'deleted'
         AND ($2::boolean OR pm.status = 'active')
       ORDER BY pm.created_at ASC`,
      [id, canManage]
    );
    res.json({ pre_members: result.rows, myRole });
  } catch (error) {
    console.error('Error fetching group pre-members:', error);
    res.status(500).json({ message: '사전등록 회원을 불러오지 못했습니다.' });
  }
});

router.post('/group/:id/pre-members', requireAuth, requireGroupAdmin, async (req, res) => {
  try {
    const name = String(req.body?.name || '').trim();
    const division = String(req.body?.division || '').trim() || null;
    if (!name) return res.status(400).json({ message: '이름을 입력해 주세요.' });
    const duplicate = await pool.query(
      `SELECT id FROM group_pre_members
       WHERE group_id = $1 AND status = 'active' AND name = $2`,
      [req.params.id, name]
    );
    if (duplicate.rowCount) return res.status(409).json({ message: '같은 이름의 사전등록 회원이 있습니다.' });
    const result = await pool.query(
      `INSERT INTO group_pre_members (id, group_id, name, division, created_by_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, name, division, status, created_at`,
      [randomUUID(), req.params.id, name, division, Number(req.user.sub)]
    );
    res.status(201).json({ message: '회원을 사전등록했습니다.', pre_member: result.rows[0] });
  } catch (error) {
    console.error('Error creating group pre-member:', error);
    res.status(500).json({ message: '회원 사전등록에 실패했습니다.' });
  }
});

router.delete('/group/:id/pre-members/:preMemberId', requireAuth, requireGroupAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE group_pre_members SET status = 'deleted', updated_at = NOW()
       WHERE id = $1 AND group_id = $2 AND status <> 'linked' RETURNING id`,
      [req.params.preMemberId, req.params.id]
    );
    if (!result.rowCount) return res.status(404).json({ message: '삭제할 사전등록 회원이 없습니다.' });
    res.json({ message: '사전등록 회원을 삭제했습니다.' });
  } catch (error) {
    console.error('Error deleting group pre-member:', error);
    res.status(500).json({ message: '사전등록 회원 삭제에 실패했습니다.' });
  }
});

router.post('/group/:id/pre-members/:preMemberId/claim-request', requireAuth, async (req, res) => {
  try {
    const { id, preMemberId } = req.params;
    const userId = Number(req.user.sub);
    const preMember = await pool.query(
      `SELECT id FROM group_pre_members WHERE id = $1 AND group_id = $2 AND status = 'active'`,
      [preMemberId, id]
    );
    if (!preMember.rowCount) return res.status(404).json({ message: '전환할 회원을 찾을 수 없습니다.' });
    const existing = await pool.query(
      `SELECT 1 FROM group_member_claims c
       JOIN group_pre_members pm ON pm.id = c.pre_member_id
       WHERE pm.group_id = $1 AND c.status = 'pending'
         AND (c.pre_member_id = $2 OR c.requested_by_id = $3)`,
      [id, preMemberId, userId]
    );
    if (existing.rowCount) return res.status(409).json({ message: '이미 처리 중인 전환 신청이 있습니다.' });
    await pool.query(
      `INSERT INTO group_member_claims (id, pre_member_id, requested_by_id)
       VALUES ($1, $2, $3)
       ON CONFLICT (pre_member_id) DO UPDATE
       SET requested_by_id = EXCLUDED.requested_by_id, status = 'pending',
           requested_at = NOW(), reviewed_by_id = NULL, reviewed_at = NULL`,
      [randomUUID(), preMemberId, userId]
    );
    res.status(201).json({ message: '회원 전환을 신청했습니다. 리더 또는 운영진의 승인을 기다려 주세요.' });
  } catch (error) {
    console.error('Error requesting group member claim:', error);
    res.status(500).json({ message: '회원 전환 신청에 실패했습니다.' });
  }
});

router.patch('/group/:id/pre-members/:preMemberId/claim-request', requireAuth, requireGroupAdmin, async (req, res) => {
  const client = await pool.connect();
  try {
    const action = req.body?.action;
    if (!['approve', 'decline'].includes(action)) {
      return res.status(400).json({ message: '처리 방식을 확인해 주세요.' });
    }
    await client.query('BEGIN');
    const claimResult = await client.query(
      `SELECT c.id, c.requested_by_id, pm.name, pm.division
       FROM group_member_claims c
       JOIN group_pre_members pm ON pm.id = c.pre_member_id
       WHERE pm.id = $1 AND pm.group_id = $2 AND pm.status = 'active' AND c.status = 'pending'
       FOR UPDATE`,
      [req.params.preMemberId, req.params.id]
    );
    if (!claimResult.rowCount) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: '처리할 전환 신청이 없습니다.' });
    }
    const claim = claimResult.rows[0];
    if (action === 'decline') {
      await client.query(
        `UPDATE group_member_claims SET status = 'declined', reviewed_by_id = $1, reviewed_at = NOW() WHERE id = $2`,
        [Number(req.user.sub), claim.id]
      );
      await client.query('COMMIT');
      return res.json({ message: '회원 전환 신청을 거절했습니다.' });
    }
    await client.query(
      `INSERT INTO group_members (id, group_id, user_id, role, division)
       VALUES ($1, $2, $3, 'member', $4)
       ON CONFLICT (group_id, user_id) DO UPDATE SET division = EXCLUDED.division`,
      [randomUUID(), req.params.id, claim.requested_by_id, claim.division]
    );
    await client.query(
      `UPDATE league_participants lp
       SET member_id = $1, division = COALESCE(NULLIF($2, ''), lp.division)
       FROM leagues l
       WHERE lp.league_id = l.id AND l.group_id = $3
         AND lp.member_id IS NULL AND lp.name = $4`,
      [claim.requested_by_id, claim.division, req.params.id, claim.name]
    );
    await client.query(
      `UPDATE group_pre_members SET status = 'linked', linked_user_id = $1, updated_at = NOW() WHERE id = $2`,
      [claim.requested_by_id, req.params.preMemberId]
    );
    await client.query(
      `UPDATE group_member_claims SET status = 'approved', reviewed_by_id = $1, reviewed_at = NOW() WHERE id = $2`,
      [Number(req.user.sub), claim.id]
    );
    await client.query('COMMIT');
    res.json({ message: '회원 전환을 승인했습니다.' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error reviewing group member claim:', error);
    res.status(500).json({ message: '회원 전환 처리에 실패했습니다.' });
  } finally {
    client.release();
  }
});

/**
 * @openapi
 * /group/{id}/member:
 *   post:
 *     summary: 클럽에 멤버 추가
 *     description: 클럽에 새로운 멤버를 추가합니다. owner 또는 admin만 가능합니다.
 *     tags: [클럽]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: 클럽 ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - user_id
 *             properties:
 *               user_id:
 *                 type: integer
 *                 description: 추가할 사용자 ID
 *     responses:
 *       201:
 *         description: 멤버 추가 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *       400:
 *         description: 사용자 ID가 제공되지 않음
 *       403:
 *         description: 권한 없음
 *       409:
 *         description: 이미 클럽에 속한 사용자
 *       500:
 *         description: 서버 오류
 */
router.post('/group/:id/member', requireAuth, requireGroupAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { user_id } = req.body;

    if (!user_id) {
      return res.status(400).json({ message: '추가할 사용자 ID가 필요합니다' });
    }

    // 이미 멤버인지 확인
    const existing = await pool.query(
      `SELECT id FROM group_members WHERE group_id = $1 AND user_id = $2`,
      [id, user_id]
    );
    if (existing.rows.length > 0) {
      return res.status(409).json({ message: '이미 클럽에 속해있는 사용자입니다' });
    }

    const memberId = randomUUID();
    await pool.query(
      `INSERT INTO group_members (id, group_id, user_id, role)
       VALUES ($1, $2, $3, 'member')`,
      [memberId, id, user_id]
    );

    res.status(201).json({ message: '멤버가 추가되었습니다' });
  } catch (error) {
    console.error('Error adding member:', error);
    res.status(500).json({ message: '내부 서버 오류' });
  }
});

/**
 * @openapi
 * /group/{id}/join:
 *   post:
 *     summary: 클럽 가입
 *     description: 사용자가 클럽에 가입합니다. 자동으로 member 역할이 부여됩니다.
 *     tags: [클럽]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: 가입할 클럽 ID
 *     responses:
 *       201:
 *         description: 클럽 가입 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *       404:
 *         description: 클럽을 찾을 수 없음
 *       409:
 *         description: 이미 가입된 클럽
 *       500:
 *         description: 서버 오류
 */
router.post('/group/:id/join', requireAuth, async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const userId = req.user.sub;

    await client.query('BEGIN');

    // 클럽 존재 확인
    const groupCheck = await client.query(
      `SELECT id FROM groups WHERE id = $1`,
      [id]
    );
    if (groupCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: '클럽을 찾을 수 없습니다' });
    }

    // 이미 멤버인지 확인
    const existing = await client.query(
      `SELECT id FROM group_members WHERE group_id = $1 AND user_id = $2`,
      [id, userId]
    );
    if (existing.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ message: '이미 가입된 클럽입니다' });
    }

    const memberId = randomUUID();
    await client.query(
      `INSERT INTO group_members (id, group_id, user_id, role)
       VALUES ($1, $2, $3, 'member')`,
      [memberId, id, userId]
    );

    const matchingPreMembers = await client.query(
      `SELECT pm.id
       FROM group_pre_members pm
       JOIN users u ON u.id = $2
       WHERE pm.group_id = $1 AND pm.status = 'active'
         AND BTRIM(pm.name) = BTRIM(u.name)`,
      [id, userId]
    );
    const matchingPreMemberId = matchingPreMembers.rowCount === 1
      ? matchingPreMembers.rows[0].id
      : null;

    if (matchingPreMemberId) {
      await client.query(
        `INSERT INTO group_member_claims (id, pre_member_id, requested_by_id)
         VALUES ($1, $2, $3)
         ON CONFLICT (pre_member_id) DO UPDATE
         SET requested_by_id = EXCLUDED.requested_by_id, status = 'pending',
             requested_at = NOW(), reviewed_by_id = NULL, reviewed_at = NULL`,
        [randomUUID(), matchingPreMemberId, userId]
      );
    }

    await client.query('COMMIT');
    res.status(201).json({
      message: matchingPreMemberId
        ? '클럽에 가입되었습니다. 사전등록 회원 전환 승인을 기다려 주세요.'
        : '클럽에 가입되었습니다',
      claim_requested: Boolean(matchingPreMemberId),
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error joining group:', error);
    res.status(500).json({ message: '내부 서버 오류' });
  } finally {
    client.release();
  }
});

/**
 * @openapi
 * /group/{id}/leave:
 *   delete:
 *     summary: 클럽 탈퇴
 *     description: 현재 로그인한 사용자가 클럽에서 탈퇴합니다. owner는 탈퇴할 수 없습니다.
 *     tags: [클럽]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: 탈퇴할 클럽 ID
 *     responses:
 *       200:
 *         description: 클럽 탈퇴 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *       403:
 *         description: owner는 탈퇴 불가
 *       404:
 *         description: 클럽 멤버가 아님
 *       500:
 *         description: 서버 오류
 */
router.delete('/group/:id/leave', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.sub;

    // 멤버 확인 및 role 조회
    const memberCheck = await pool.query(
      `SELECT id, role FROM group_members WHERE group_id = $1 AND user_id = $2`,
      [id, userId]
    );
    if (memberCheck.rows.length === 0) {
      return res.status(404).json({ message: '클럽 멤버가 아닙니다' });
    }

    // owner는 탈퇴 불가
    if (memberCheck.rows[0].role === 'owner') {
      return res.status(403).json({ message: 'owner는 클럽을 탈퇴할 수 없습니다. 클럽을 삭제하거나 owner를 변경해주세요.' });
    }

    await pool.query(
      `DELETE FROM group_members WHERE group_id = $1 AND user_id = $2`,
      [id, userId]
    );

    res.json({ message: '클럽에서 탈퇴했습니다' });
  } catch (error) {
    console.error('Error leaving group:', error);
    res.status(500).json({ message: '내부 서버 오류' });
  }
});

/**
 * @openapi
 * /group/{id}/member/{userId}/role:
 *   patch:
 *     summary: 멤버 권한 변경
 *     description: 클럽 멤버의 역할을 변경합니다. owner만 가능하며, member와 admin 간 변경만 가능합니다.
 *     tags: [클럽]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: 클럽 ID
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: 대상 사용자 ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - role
 *             properties:
 *               role:
 *                 type: string
 *                 enum: [member, admin]
 *                 description: 변경할 역할
 *     responses:
 *       200:
 *         description: 권한 변경 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *       400:
 *         description: 유효하지 않은 역할 또는 owner 권한 변경 시도
 *       403:
 *         description: 권한 없음 (owner만 가능)
 *       404:
 *         description: 멤버를 찾을 수 없음
 *       500:
 *         description: 서버 오류
 */
router.patch('/group/:id/member/:userId/role', requireAuth, requireGroupOwner, async (req, res) => {
  try {
    const { id, userId: targetUserId } = req.params;
    const { role } = req.body;

    if (!role || !['member', 'admin'].includes(role)) {
      return res.status(400).json({ message: '유효하지 않은 권한입니다. member 또는 admin만 가능합니다' });
    }

    // 대상 멤버 확인
    const targetCheck = await pool.query(
      `SELECT role FROM group_members WHERE group_id = $1 AND user_id = $2`,
      [id, targetUserId]
    );
    if (targetCheck.rows.length === 0) {
      return res.status(404).json({ message: '해당 멤버를 찾을 수 없습니다' });
    }
    if (targetCheck.rows[0].role === 'owner') {
      return res.status(400).json({ message: '리더의 권한은 변경할 수 없습니다' });
    }

    await pool.query(
      `UPDATE group_members SET role = $1 WHERE group_id = $2 AND user_id = $3`,
      [role, id, targetUserId]
    );

    res.status(200).json({ message: '권한이 변경되었습니다' });
  } catch (error) {
    console.error('Error updating member role:', error);
    res.status(500).json({ message: '내부 서버 오류' });
  }
});

/**
 * @openapi
 * /group/{id}/member/{userId}:
 *   patch:
 *     summary: 멤버 정보 수정
 *     description: 클럽 멤버의 정보(부수 등)를 수정합니다. owner 또는 admin만 가능합니다.
 *     tags: [클럽]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: 클럽 ID
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: 대상 사용자 ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               division:
 *                 type: string
 *                 description: 부수 (예 1부, 2부, A조 등)
 *     responses:
 *       200:
 *         description: 멤버 정보 수정 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *       403:
 *         description: 권한 없음
 *       404:
 *         description: 멤버를 찾을 수 없음
 *       500:
 *         description: 서버 오류
 */
router.patch('/group/:id/member/:userId', requireAuth, requireGroupAdmin, async (req, res) => {
  try {
    const { id, userId: targetUserId } = req.params;
    const { division } = req.body;

    // 대상 멤버 확인
    const targetCheck = await pool.query(
      `SELECT id FROM group_members WHERE group_id = $1 AND user_id = $2`,
      [id, targetUserId]
    );
    if (targetCheck.rows.length === 0) {
      return res.status(404).json({ message: '해당 멤버를 찾을 수 없습니다' });
    }

    const updates = [];
    const values = [];
    let paramIdx = 1;

    if (division !== undefined) {
      updates.push(`division = $${paramIdx++}`);
      values.push(division);
    }

    if (updates.length === 0) {
      return res.status(400).json({ message: '수정할 내용이 없습니다' });
    }

    values.push(id, targetUserId);
    await pool.query(
      `UPDATE group_members SET ${updates.join(', ')} WHERE group_id = $${paramIdx++} AND user_id = $${paramIdx}`,
      values
    );

    res.status(200).json({ message: '멤버 정보가 수정되었습니다' });
  } catch (error) {
    console.error('Error updating member:', error);
    res.status(500).json({ message: '내부 서버 오류' });
  }
});

/**
 * @openapi
 * /group/{id}:
 *   patch:
 *     summary: 클럽 정보 수정
 *     description: 클럽의 기본 정보를 수정합니다. owner만 가능합니다.
 *     tags: [클럽]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: 클럽 ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 description: 클럽명
 *               description:
 *                 type: string
 *                 description: 클럽 설명
 *               sport:
 *                 type: string
 *                 description: 종목
 *               type:
 *                 type: string
 *                 description: 종류
 *               region_city:
 *                 type: string
 *                 description: 지역(시/도)
 *               region_district:
 *                 type: string
 *                 description: 지역(구/군)
 *               founded_at:
 *                 type: string
 *                 format: date
 *                 description: 창립일
 *     responses:
 *       200:
 *         description: 클럽 정보 수정 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *       403:
 *         description: 권한 없음 (owner만 가능)
 *       404:
 *         description: 클럽을 찾을 수 없음
 *       500:
 *         description: 서버 오류
 */
router.patch('/group/:id', requireAuth, requireGroupOwner, async (req, res) => {
  const client = await pool.connect();

  try {
    const { id } = req.params;
    const { name, description, sport, region_city, region_district, founded_at, address, address_detail, lat, lng, links, } = req.body;

    const hasLinks = Array.isArray(links);
    const updates = [];
    const values = [];
    let paramIdx = 1;

    if (name !== undefined) {
      updates.push(`name = $${paramIdx++}`);
      values.push(name);
    }
    if (description !== undefined) {
      updates.push(`description = $${paramIdx++}`);
      values.push(description);
    }
    if (sport !== undefined) {
      updates.push(`sport = $${paramIdx++}`);
      values.push(sport);
    }
    if (region_city !== undefined) {
      updates.push(`region_city = $${paramIdx++}`);
      values.push(region_city);
    }
    if (region_district !== undefined) {
      updates.push(`region_district = $${paramIdx++}`);
      values.push(region_district);
    }
    if (founded_at !== undefined) {
      updates.push(`founded_at = $${paramIdx++}`);
      values.push(founded_at);
    }
    if (address !== undefined) {
      updates.push(`address = $${paramIdx++}`);
      values.push(address);
    }
    if (address_detail !== undefined) {
      updates.push(`address_detail = $${paramIdx++}`);
      values.push(address_detail);
    }
    if (lat !== undefined) {
      updates.push(`lat = $${paramIdx++}`);
      values.push(lat);
    }
    if (lng !== undefined) {
      updates.push(`lng = $${paramIdx++}`);
      values.push(lng);
    }

    if (updates.length === 0 && !hasLinks) {
      return res.status(400).json({ message: '수정할 내용이 없습니다' });
    }

    await client.query('BEGIN');

    // group 기본 정보 수정
    if ( updates.length > 0 ) {
      updates.push(`updated_at = CURRENT_TIMESTAMP`);

      values.push(id);


      await client.query(
        `UPDATE groups SET ${updates.join(', ')} WHERE id = $${paramIdx}`,
        values
      );
    }

    // group_links 수정
    if (hasLinks) {
      await client.query(
        `DELETE FROM group_links
         WHERE group_id = $1`,
        [id]
      );

      for (const [index, link] of links.entries()) {
        if (!link.url || !link.url.trim()) continue;

        await client.query(
          `INSERT INTO group_links
           (id, group_id, label, url, sort_order)
           VALUES ($1, $2, $3, $4, $5)`,
          [
            randomUUID(),
            id,
            link.label?.trim() || null,
            link.url.trim(),
            link.sort_order ?? index + 1,
          ]
        );
      }
    }

    await client.query('COMMIT');

    res.status(200).json({ message: '클럽 정보가 수정되었습니다' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error updating group:', error);
    res.status(500).json({ message: '내부 서버 오류' });
  } finally {
    client.release();
  }
});

/**
 * @openapi
 * /group/{id}:
 *   delete:
 *     summary: 클럽 삭제
 *     description: 클럽을 삭제합니다. owner만 가능하며, 클럽의 모든 멤버와 관련 데이터가 삭제됩니다.
 *     tags: [클럽]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: 클럽 ID
 *     responses:
 *       200:
 *         description: 클럽 삭제 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *       403:
 *         description: 권한 없음 (owner만 가능)
 *       404:
 *         description: 클럽을 찾을 수 없음
 *       500:
 *         description: 서버 오류
 */
router.delete('/group/:id', requireAuth, requireGroupOwner, async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;

    await client.query('BEGIN');

    // 클럽 멤버 삭제
    await client.query(
      `DELETE FROM group_members WHERE group_id = $1`,
      [id]
    );

    // 클럽 삭제
    const result = await client.query(
      `DELETE FROM groups WHERE id = $1`,
      [id]
    );

    if (result.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: '클럽을 찾을 수 없습니다' });
    }

    await client.query('COMMIT');
    res.status(200).json({ message: '클럽이 삭제되었습니다' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error deleting group:', error);
    res.status(500).json({ message: '내부 서버 오류' });
  } finally {
    client.release();
  }
});

/**
 * @openapi
 * /group/{id}/member/{userId}:
 *   delete:
 *     summary: 클럽에서 멤버 제거
 *     description: 클럽에서 멤버를 제거합니다. owner 또는 admin만 가능하며, owner는 제거할 수 없습니다.
 *     tags: [클럽]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: 클럽 ID
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: 제거할 사용자 ID
 *     responses:
 *       200:
 *         description: 멤버 제거 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *       400:
 *         description: owner 제거 시도
 *       403:
 *         description: 권한 없음
 *       404:
 *         description: 멤버를 찾을 수 없음
 *       500:
 *         description: 서버 오류
 */
router.delete('/group/:id/member/:userId', requireAuth, requireGroupAdmin, async (req, res) => {
  try {
    const { id, userId: targetUserId } = req.params;

    // owner는 제거 불가
    const targetCheck = await pool.query(
      `SELECT role FROM group_members WHERE group_id = $1 AND user_id = $2`,
      [id, targetUserId]
    );
    if (targetCheck.rows.length === 0) {
      return res.status(404).json({ message: '해당 멤버를 찾을 수 없습니다' });
    }
    if (targetCheck.rows[0].role === 'owner') {
      return res.status(400).json({ message: '클럽 소유자는 제거할 수 없습니다' });
    }

    await pool.query(
      `DELETE FROM group_members WHERE group_id = $1 AND user_id = $2`,
      [id, targetUserId]
    );

    res.status(200).json({ message: '멤버가 제거되었습니다' });
  } catch (error) {
    console.error('Error removing member:', error);
    res.status(500).json({ message: '내부 서버 오류' });
  }
});

/**
 * @openapi
 * /group/{id}/ranking/points:
 *   get:
 *     summary: 연도별 포인트 순위 조회
 *     description: 클럽 내부 또는 같은 종목 전국 기준의 리그/대회 포인트 순위를 조회합니다.
 *     tags: [클럽]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: year
 *         schema: { type: integer }
 *       - in: query
 *         name: scope
 *         schema:
 *           type: string
 *           enum: [club, national]
 *     responses:
 *       200:
 *         description: 조회 성공
 *       403:
 *         description: 권한 없음
 */
router.get('/group/:id/ranking/points', requireAuth, async (req, res) => {
  try {
    const userId = Number(req.user.sub);
    const { id: groupId } = req.params;
    const year = req.query.year ? Number(req.query.year) : undefined;
    const seasonId = req.query.season_id ? String(req.query.season_id) : undefined;
    const scope = req.query.scope === 'national' ? 'national' : 'club';

    const accessCheck = await pool.query(
      `SELECT role FROM group_members WHERE group_id = $1 AND user_id = $2`,
      [groupId, userId],
    );
    if (accessCheck.rowCount === 0) {
      return res.status(403).json({ message: '권한이 없습니다.' });
    }

    const data = await getPointRanking(groupId, year, scope, seasonId);
    if (!data) return res.status(404).json({ message: '클럽을 찾을 수 없습니다.' });

    return res.json({
      ...data,
      myRole: accessCheck.rows[0].role,
      currentUserId: userId,
    });
  } catch (error) {
    console.error('Error fetching point ranking:', error);
    return res.status(500).json({ message: '서버 오류' });
  }
});

router.get('/group/:id/ranking/seasons', requireAuth, async (req, res) => {
  try {
    const userId = Number(req.user.sub);
    const { id: groupId } = req.params;
    const accessCheck = await pool.query(
      `SELECT role FROM group_members WHERE group_id = $1 AND user_id = $2`,
      [groupId, userId],
    );
    if (accessCheck.rowCount === 0) return res.status(403).json({ message: '권한이 없습니다.' });
    const result = await pool.query(
      `SELECT id, name, start_date, end_date, auto_renew, created_at
         FROM group_ranking_seasons
        WHERE group_id = $1
        ORDER BY start_date DESC, created_at DESC`,
      [groupId],
    );
    return res.json({ seasons: result.rows, myRole: accessCheck.rows[0].role });
  } catch (error) {
    console.error('Error fetching ranking seasons:', error);
    return res.status(500).json({ message: '서버 오류' });
  }
});

router.post('/group/:id/ranking/seasons', requireAuth, requireGroupAdmin, async (req, res) => {
  try {
    const { id: groupId } = req.params;
    const userId = Number(req.user.sub);
    const payload = rankingSeasonSchema.parse(req.body);
    const overlap = await pool.query(
      `SELECT 1 FROM group_ranking_seasons
        WHERE group_id = $1
          AND start_date <= $3::date
          AND end_date >= $2::date
        LIMIT 1`,
      [groupId, payload.start_date, payload.end_date],
    );
    if (overlap.rowCount > 0) {
      return res.status(409).json({ message: '기존 시즌과 기간이 겹칩니다.' });
    }
    const name = `${payload.start_date.replaceAll('-', '.')} ~ ${payload.end_date.replaceAll('-', '.')}`;
    const result = await pool.query(
      `INSERT INTO group_ranking_seasons (group_id, name, start_date, end_date, auto_renew, created_by_id)
       VALUES ($1, $2, $3::date, $4::date, $5, $6)
       RETURNING id, name, start_date, end_date, auto_renew, created_at`,
      [groupId, name, payload.start_date, payload.end_date, payload.auto_renew, userId],
    );
    return res.status(201).json({ message: '시즌 기간이 설정되었습니다.', season: result.rows[0] });
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ errors: error.errors });
    console.error('Error creating ranking season:', error);
    return res.status(500).json({ message: '서버 오류' });
  }
});

router.delete('/group/:id/ranking/seasons/:seasonId', requireAuth, requireGroupAdmin, async (req, res) => {
  try {
    const { id: groupId, seasonId } = req.params;
    const result = await pool.query(
      `DELETE FROM group_ranking_seasons WHERE id = $1 AND group_id = $2 RETURNING id`,
      [seasonId, groupId],
    );
    if (result.rowCount === 0) return res.status(404).json({ message: '시즌을 찾을 수 없습니다.' });
    return res.json({ message: '시즌이 삭제되었습니다.' });
  } catch (error) {
    console.error('Error deleting ranking season:', error);
    return res.status(500).json({ message: '서버 오류' });
  }
});

/**
 * @openapi
 * /group/{id}/ranking:
 *   get:
 *     summary: 클럽 랭킹 조회
 *     description: 클럽 내부 멤버 랭킹 목록을 조회합니다.
 *     tags: [클럽]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: 랭킹 조회 성공
 *       403:
 *         description: 권한 없음
 */
router.get('/group/:id/ranking', requireAuth, async (req, res) => {
  try {
    const userId = Number(req.user.sub);
    const { id: groupId } = req.params;

    const accessCheck = await pool.query(
      `SELECT role FROM group_members WHERE group_id = $1 AND user_id = $2`,
      [groupId, userId],
    );
    if (accessCheck.rowCount === 0) {
      return res.status(403).json({ message: '권한이 없습니다.' });
    }

    const data = await getGroupRanking(groupId);
    if (!data) return res.status(404).json({ message: '클럽을 찾을 수 없습니다.' });

    return res.json({
      ...data,
      myRole: accessCheck.rows[0].role,
    });
  } catch (error) {
    console.error('Error fetching group ranking:', error);
    return res.status(500).json({ message: '서버 오류' });
  }
});

/**
 * @openapi
 * /group/{id}/ranking/{memberId}:
 *   get:
 *     summary: 클럽 회원 랭킹 상세 조회
 *     description: 한 회원의 랭킹 상세와 최근 레이팅 변동 내역을 조회합니다.
 *     tags: [클럽]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: memberId
 *         required: true
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: 랭킹 상세 조회 성공
 */
router.get('/group/:id/ranking/:memberId', requireAuth, async (req, res) => {
  try {
    const userId = Number(req.user.sub);
    const { id: groupId, memberId } = req.params;

    const accessCheck = await pool.query(
      `SELECT 1 FROM group_members WHERE group_id = $1 AND user_id = $2`,
      [groupId, userId],
    );
    if (accessCheck.rowCount === 0) {
      return res.status(403).json({ message: '권한이 없습니다.' });
    }

    const data = await getGroupRankingDetail(groupId, Number(memberId));
    if (!data) return res.status(404).json({ message: '랭킹 정보를 찾을 수 없습니다.' });

    return res.json(data);
  } catch (error) {
    console.error('Error fetching group ranking detail:', error);
    return res.status(500).json({ message: '서버 오류' });
  }
});

/**
 * @openapi
 * /group/{id}/ranking/rebuild:
 *   post:
 *     summary: 클럽 랭킹 수동 재계산
 *     description: owner/admin이 클럽 랭킹을 강제로 재계산합니다.
 *     tags: [클럽]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 재계산 성공
 */
router.post('/group/:id/ranking/rebuild', requireAuth, requireGroupAdmin, async (req, res) => {
  try {
    const { id: groupId } = req.params;
    const result = await rebuildGroupRanking(groupId);
    return res.json({
      message: '클럽 랭킹을 재계산했습니다.',
      summary: result,
    });
  } catch (error) {
    console.error('Error rebuilding group ranking:', error);
    return res.status(500).json({ message: '서버 오류' });
  }
});

/**
 * @openapi
 * /group/{id}/ranking/settings:
 *   patch:
 *     summary: 클럽 랭킹 설정 수정
 *     description: owner/admin이 클럽 랭킹 설정을 수정합니다.
 *     tags: [클럽]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: 설정 저장 성공
 */
router.patch('/group/:id/ranking/settings', requireAuth, requireGroupAdmin, async (req, res) => {
  try {
    const { id: groupId } = req.params;
    const payload = rankingSettingsSchema.parse(req.body);
    const settings = await updateGroupRankingSettings(groupId, payload);
    return res.json({
      message: '클럽 랭킹 설정이 저장되었습니다.',
      settings,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ errors: error.errors });
    }
    console.error('Error updating ranking settings:', error);
    return res.status(500).json({ message: '서버 오류' });
  }
});

/**
 * @openapi
 * /group/{id}/member/{userId}:
 *   get:
 *     summary: 클럽 회원 상세 조회
 *     description: 특정 클럽 회원의 상세 정보(프로필, 올해 리그 통계, 가입한 클럽 목록)를 반환합니다.
 *     tags: [클럽]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *         description: 클럽 ID
 *       - in: path
 *         name: userId
 *         required: true
 *         schema: { type: integer }
 *         description: 조회할 회원의 user_id
 *     responses:
 *       200:
 *         description: 회원 상세 정보
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 member:
 *                   type: object
 *                   properties:
 *                     user_id:
 *                       type: integer
 *                     name:
 *                       type: string
 *                     email:
 *                       type: string
 *                     role:
 *                       type: string
 *                     division:
 *                       type: string
 *                       nullable: true
 *                     joined_at:
 *                       type: string
 *                       format: date-time
 *                 stats:
 *                   type: object
 *                   properties:
 *                     year:
 *                       type: integer
 *                     attendance:
 *                       type: integer
 *                     league_attendance:
 *                       type: integer
 *                     tournament_attendance:
 *                       type: integer
 *                     wins:
 *                       type: integer
 *                     losses:
 *                       type: integer
 *                     championships:
 *                       type: integer
 *                 ranking_summary:
 *                   type: object
 *                   nullable: true
 *                 clubs:
 *                   type: array
 *                   items:
 *                     type: object
 *       403:
 *         description: 권한 없음 (해당 클럽 멤버 아님)
 *       404:
 *         description: 회원을 찾을 수 없음
 *       500:
 *         description: 서버 오류
 */
router.get('/group/:id/member/:userId', requireAuth, async (req, res) => {
  try {
    const requesterId = Number(req.user.sub);
    const { id: groupId, userId: targetUserId } = req.params;

    // 요청자가 이 클럽 멤버인지 확인
    const accessCheck = await pool.query(
      `SELECT 1 FROM group_members WHERE group_id = $1 AND user_id = $2`,
      [groupId, requesterId],
    );
    if (accessCheck.rowCount === 0) return res.status(403).json({ message: '권한이 없습니다.' });

    // 대상 회원 정보
    const memberResult = await pool.query(
      `SELECT gm.role, gm.division, gm.joined_at, u.id AS user_id, u.name, u.email
       FROM group_members gm
       JOIN users u ON u.id = gm.user_id
       WHERE gm.group_id = $1 AND gm.user_id = $2`,
      [groupId, targetUserId],
    );
    if (memberResult.rowCount === 0) return res.status(404).json({ message: '회원을 찾을 수 없습니다.' });

    const member = memberResult.rows[0];
    const year = new Date().getFullYear();

    // 올해 리그/대회 통계
    const statsResult = await pool.query(
      `WITH member_participants AS (
         SELECT DISTINCT lp.id AS participant_id, lp.league_id
         FROM league_participants lp
         JOIN leagues l ON l.id = lp.league_id
         JOIN group_members ug ON ug.group_id = l.group_id AND ug.user_id = $1
         WHERE (lp.member_id = $1 OR (lp.member_id IS NULL AND lp.name = $2))
           AND EXTRACT(YEAR FROM l.start_date) = $3
       ),
       league_attendance AS (
         SELECT COUNT(DISTINCT mp.league_id)::int AS count
         FROM member_participants mp
         JOIN league_matches m ON m.league_id = mp.league_id
         WHERE m.bracket IS NULL
       ),
       tournament_attendance AS (
         SELECT COUNT(DISTINCT mp.league_id)::int AS count
         FROM member_participants mp
         JOIN league_matches m
           ON m.league_id = mp.league_id
          AND (m.participant_a_id = mp.participant_id OR m.participant_b_id = mp.participant_id)
         WHERE m.bracket IS NOT NULL
       ),
       match_stats AS (
         SELECT
           COUNT(CASE
             WHEN (m.participant_a_id = mp.participant_id AND m.score_a > m.score_b) OR
                  (m.participant_b_id = mp.participant_id AND m.score_b > m.score_a) THEN 1
           END)::int AS wins,
           COUNT(CASE
             WHEN (m.participant_a_id = mp.participant_id AND m.score_a < m.score_b) OR
                  (m.participant_b_id = mp.participant_id AND m.score_b < m.score_a) THEN 1
           END)::int AS losses
         FROM member_participants mp
         LEFT JOIN league_matches m
           ON (m.participant_a_id = mp.participant_id OR m.participant_b_id = mp.participant_id)
          AND m.status = 'done'
       )
       SELECT
         COALESCE((SELECT count FROM league_attendance), 0) AS league_attendance,
         COALESCE((SELECT count FROM tournament_attendance), 0) AS tournament_attendance,
         COALESCE((SELECT wins FROM match_stats), 0) AS wins,
         COALESCE((SELECT losses FROM match_stats), 0) AS losses`,
      [targetUserId, member.name, year],
    );

    // 올해 우승 수: 참가 리그 내 최다 승리 횟수 기준
    const championResult = await pool.query(
      `WITH member_participants AS (
         SELECT DISTINCT lp.id AS participant_id, lp.league_id
         FROM league_participants lp
         JOIN leagues l ON l.id = lp.league_id
         JOIN group_members ug ON ug.group_id = l.group_id AND ug.user_id = $1
         WHERE (lp.member_id = $1 OR (lp.member_id IS NULL AND lp.name = $2))
           AND EXTRACT(YEAR FROM l.start_date) = $3
       ),
       all_wins AS (
         SELECT lp.id AS participant_id, lp.league_id,
           COUNT(CASE
             WHEN (m.participant_a_id = lp.id AND m.score_a > m.score_b) OR
                  (m.participant_b_id = lp.id AND m.score_b > m.score_a) THEN 1
           END) AS wins
         FROM league_participants lp
         LEFT JOIN league_matches m ON (m.participant_a_id = lp.id OR m.participant_b_id = lp.id) AND m.status = 'done'
         WHERE lp.league_id IN (SELECT league_id FROM member_participants)
         GROUP BY lp.id, lp.league_id
       ),
       league_max AS (
         SELECT league_id, MAX(wins) AS max_wins FROM all_wins GROUP BY league_id
       ),
       member_wins AS (
         SELECT mp.league_id, aw.wins
         FROM member_participants mp
         JOIN all_wins aw ON aw.participant_id = mp.participant_id AND aw.league_id = mp.league_id
       )
       SELECT COUNT(*) AS championships
       FROM member_wins mw
       JOIN league_max lm ON lm.league_id = mw.league_id
       WHERE mw.wins = lm.max_wins AND mw.wins > 0`,
      [targetUserId, member.name, year],
    );

    const rankingSummaryResult = await pool.query(
      `SELECT rank, rating, wins, losses, matches_played, win_rate, streak, last_match_at
         FROM group_rankings
        WHERE group_id = $1 AND member_id = $2`,
      [groupId, targetUserId],
    );

    // 가입한 모든 클럽
    const clubsResult = await pool.query(
      `SELECT g.id, g.name, g.sport, gm.role
       FROM group_members gm
       JOIN groups g ON g.id = gm.group_id
       WHERE gm.user_id = $1
       ORDER BY gm.joined_at ASC`,
      [targetUserId],
    );

    const stats = statsResult.rows[0];
    return res.json({
      member: {
        user_id: member.user_id,
        name: member.name,
        email: member.email,
        role: member.role,
        division: member.division,
        joined_at: member.joined_at,
      },
      stats: {
        year,
        attendance: (Number(stats.league_attendance) || 0) + (Number(stats.tournament_attendance) || 0),
        league_attendance: Number(stats.league_attendance) || 0,
        tournament_attendance: Number(stats.tournament_attendance) || 0,
        wins: Number(stats.wins) || 0,
        losses: Number(stats.losses) || 0,
        championships: Number(championResult.rows[0].championships) || 0,
      },
      ranking_summary: rankingSummaryResult.rows[0]
        ? {
            rank: rankingSummaryResult.rows[0].rank == null ? null : Number(rankingSummaryResult.rows[0].rank),
            rating: Number(rankingSummaryResult.rows[0].rating),
            wins: Number(rankingSummaryResult.rows[0].wins),
            losses: Number(rankingSummaryResult.rows[0].losses),
            matches_played: Number(rankingSummaryResult.rows[0].matches_played),
            win_rate: Number(rankingSummaryResult.rows[0].win_rate),
            streak: Number(rankingSummaryResult.rows[0].streak),
            last_match_at: rankingSummaryResult.rows[0].last_match_at,
          }
        : null,
      clubs: clubsResult.rows,
    });
  } catch (error) {
    console.error('Error fetching member detail:', error);
    return res.status(500).json({ message: '서버 오류' });
  }
});

/**
 * @openapi
 * /group/{id}/member/{userId}/leagues:
 *   get:
 *     summary: 클럽 회원 리그·대회 참여내역 조회
 *     description: 특정 클럽 회원이 해당 클럽에서 참가한 리그·대회 목록과 전적을 조회합니다.
 *     tags: [클럽]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *         description: 클럽 ID
 *       - in: path
 *         name: userId
 *         required: true
 *         schema: { type: integer }
 *         description: 조회할 회원의 user_id
 *     responses:
 *       200:
 *         description: 참여내역 조회 성공
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 member:
 *                   type: object
 *                   properties:
 *                     user_id:
 *                       type: integer
 *                     name:
 *                       type: string
 *                     email:
 *                       type: string
 *                     role:
 *                       type: string
 *                     division:
 *                       type: string
 *                       nullable: true
 *                     joined_at:
 *                       type: string
 *                       format: date-time
 *                 histories:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       league_id:
 *                         type: string
 *                         format: uuid
 *                       league_name:
 *                         type: string
 *                       format:
 *                         type: string
 *                         nullable: true
 *                       type:
 *                         type: string
 *                         nullable: true
 *                       sport:
 *                         type: string
 *                         nullable: true
 *                       start_date:
 *                         type: string
 *                         nullable: true
 *                       status:
 *                         type: string
 *                         nullable: true
 *                       division:
 *                         type: string
 *                         nullable: true
 *                       participant_name:
 *                         type: string
 *                         nullable: true
 *                       wins:
 *                         type: integer
 *                       losses:
 *                         type: integer
 *                       matches_played:
 *                         type: integer
 *                       has_league_stage:
 *                         type: boolean
 *                       has_tournament_stage:
 *                         type: boolean
 *       403:
 *         description: 권한 없음
 *       404:
 *         description: 회원을 찾을 수 없음
 *       500:
 *         description: 서버 오류
 */
router.get('/group/:id/member/:userId/leagues', requireAuth, async (req, res) => {
  try {
    const requesterId = Number(req.user.sub);
    const { id: groupId, userId: targetUserId } = req.params;

    const accessCheck = await pool.query(
      `SELECT 1 FROM group_members WHERE group_id = $1 AND user_id = $2`,
      [groupId, requesterId],
    );
    if (accessCheck.rowCount === 0) return res.status(403).json({ message: '권한이 없습니다.' });

    const memberResult = await pool.query(
      `SELECT gm.role, gm.division, gm.joined_at, u.id AS user_id, u.name, u.email
       FROM group_members gm
       JOIN users u ON u.id = gm.user_id
       WHERE gm.group_id = $1 AND gm.user_id = $2`,
      [groupId, targetUserId],
    );
    if (memberResult.rowCount === 0) return res.status(404).json({ message: '회원을 찾을 수 없습니다.' });

    const member = memberResult.rows[0];

    const historyResult = await pool.query(
      `WITH member_participants AS (
         SELECT DISTINCT
           l.id AS league_id,
           l.name AS league_name,
           l.format,
           l.type,
           l.sport,
           l.start_date,
           l.status,
           lp.id AS participant_id,
           COALESCE(lp.division, gm.division, '') AS division,
           COALESCE(lp.name, u.name, u.email) AS participant_name
         FROM league_participants lp
         JOIN leagues l ON l.id = lp.league_id
         JOIN users u ON u.id = $2
         LEFT JOIN group_members gm ON gm.group_id = l.group_id AND gm.user_id = u.id
         WHERE l.group_id = $1
           AND (lp.member_id = $2 OR (lp.member_id IS NULL AND u.name IS NOT NULL AND lp.name = u.name))
       )
       SELECT
         mp.league_id,
         mp.league_name,
         mp.format,
         mp.type,
         mp.sport,
         mp.start_date::text,
         mp.status,
         mp.division,
         mp.participant_name,
         COUNT(CASE
           WHEN m.status = 'done'
            AND ((m.participant_a_id = mp.participant_id AND m.score_a > m.score_b)
              OR (m.participant_b_id = mp.participant_id AND m.score_b > m.score_a)) THEN 1
         END)::int AS wins,
         COUNT(CASE
           WHEN m.status = 'done'
            AND ((m.participant_a_id = mp.participant_id AND m.score_a < m.score_b)
              OR (m.participant_b_id = mp.participant_id AND m.score_b < m.score_a)) THEN 1
         END)::int AS losses,
         COUNT(CASE WHEN m.status = 'done' THEN 1 END)::int AS matches_played,
         BOOL_OR(m.bracket IS NULL) AS has_league_stage,
         BOOL_OR(m.bracket IS NOT NULL) AS has_tournament_stage
       FROM member_participants mp
       LEFT JOIN league_matches m
         ON (m.participant_a_id = mp.participant_id OR m.participant_b_id = mp.participant_id)
       GROUP BY
         mp.league_id, mp.league_name, mp.format, mp.type, mp.sport, mp.start_date, mp.status, mp.division, mp.participant_name
       ORDER BY mp.start_date DESC, mp.league_name ASC`,
      [groupId, targetUserId],
    );

    return res.json({
      member: {
        user_id: member.user_id,
        name: member.name,
        email: member.email,
        role: member.role,
        division: member.division,
        joined_at: member.joined_at,
      },
      histories: historyResult.rows.map((row) => ({
        league_id: row.league_id,
        league_name: row.league_name,
        format: row.format,
        type: row.type,
        sport: row.sport,
        start_date: row.start_date,
        status: row.status,
        division: row.division || null,
        participant_name: row.participant_name,
        wins: Number(row.wins) || 0,
        losses: Number(row.losses) || 0,
        matches_played: Number(row.matches_played) || 0,
        has_league_stage: Boolean(row.has_league_stage),
        has_tournament_stage: Boolean(row.has_tournament_stage),
      })),
    });
  } catch (error) {
    console.error('Error fetching member league history:', error);
    return res.status(500).json({ message: '서버 오류' });
  }
});

module.exports = router;
