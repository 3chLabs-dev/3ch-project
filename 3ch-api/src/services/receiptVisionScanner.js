const OPENAI_RESPONSES_URL = 'https://api.openai.com/v1/responses';

function extractOutputText(response) {
  if (typeof response.output_text === 'string') return response.output_text;
  return (response.output ?? []).flatMap((item) => item.content ?? [])
    .filter((content) => ['output_text', 'text'].includes(content.type) && typeof content.text === 'string')
    .map((content) => content.text).join('\n');
}

function parseJsonObject(text) {
  const trimmed = String(text || '').trim();
  if (!trimmed) throw new Error('영수증 인식 응답이 비어 있습니다.');
  try { return JSON.parse(trimmed); }
  catch {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('영수증 인식 응답에서 JSON을 찾을 수 없습니다.');
    return JSON.parse(match[0]);
  }
}

const RECEIPT_PROMPT = `You extract line items from a Korean restaurant receipt.
The supplied images are multiple sections or views of ONE receipt. Read them together in receipt order. Overlapping photographs may show the same physical row more than once: return that row only once. Preserve genuinely separate repeated menu rows; do not deduplicate only by identical name or amount. Use visible neighboring rows and layout to identify overlaps. Read the final receipt total once, never sum repeated copies of the same total. Mark uncertain overlap rows needsReview=true.
Read only actual purchased menu rows. Do not return headers, subtotals, VAT, total, payment method, card information, merchant information, or table numbers as line items.
For every line item return the printed menu name, unit price, quantity, and line amount. The line amount is authoritative. Preserve add-ons or modifiers as separate rows when the receipt prints a separate amount for them. Keep zero-amount menu rows with amount=0 so the user can review them.
Read the final charged total from labels such as 합계, 받을금액, 결제금액, or 총액. Do not confuse taxable supply value or VAT with the final total.
If unit price times quantity differs from the printed line amount, preserve all printed values and set needsReview=true. Do not invent obscured digits. Return integers in Korean won without commas or currency symbols.
Respond only with the required JSON.`;

async function scanReceiptWithOpenAIVision({ images }) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) { const error = new Error('OPENAI_API_KEY가 설정되어 있지 않습니다.'); error.code = 'OPENAI_API_KEY_MISSING'; throw error; }
  const model = process.env.OPENAI_VISION_MODEL || 'gpt-6-luna';
  const response = await fetch(OPENAI_RESPONSES_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      ...(model.startsWith('gpt-4') ? { temperature: 0 } : {}),
      ...(model.startsWith('gpt-6') ? { reasoning: { effort: 'low' } } : {}),
      input: [{ role: 'user', content: [
        { type: 'input_text', text: RECEIPT_PROMPT },
        ...images.map(({ imageBuffer, mimeType }) => ({ type: 'input_image', image_url: `data:${mimeType};base64,${imageBuffer.toString('base64')}` })),
      ] }],
      text: { format: { type: 'json_schema', name: 'after_party_receipt', strict: true, schema: {
        type: 'object', additionalProperties: false,
        required: ['merchant', 'purchasedAt', 'receiptTotal', 'items'],
        properties: {
          merchant: { type: 'string' }, purchasedAt: { type: 'string' },
          receiptTotal: { type: 'integer', minimum: 0, maximum: 1000000000 },
          items: { type: 'array', items: { type: 'object', additionalProperties: false,
            required: ['name', 'unitPrice', 'quantity', 'amount', 'confidence', 'needsReview'],
            properties: {
              name: { type: 'string' }, unitPrice: { type: 'integer', minimum: 0, maximum: 1000000000 },
              quantity: { type: 'integer', minimum: 1, maximum: 999 }, amount: { type: 'integer', minimum: 0, maximum: 1000000000 },
              confidence: { type: 'number', minimum: 0, maximum: 1 }, needsReview: { type: 'boolean' },
            },
          } },
      } } } },
    }),
  });
  const responseBody = await response.json().catch(() => ({}));
  if (!response.ok) { const error = new Error(responseBody.error?.message || '영수증 사진 인식에 실패했습니다.'); error.code = 'OPENAI_VISION_FAILED'; throw error; }
  return { engine: model, result: parseJsonObject(extractOutputText(responseBody)) };
}

module.exports = { scanReceiptWithOpenAIVision };
