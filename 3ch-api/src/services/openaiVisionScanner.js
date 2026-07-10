const OPENAI_RESPONSES_URL = 'https://api.openai.com/v1/responses';

const SYSTEM_PROMPT = `이 이미지는 우리리그 조별 리그 대진표입니다.
상단 열과 좌측 행에는 동일한 참가자가 같은 순서로 배치되어 있습니다.
각 경기 결과는 한 칸에 3:1처럼 적히는 것이 아니라,
각 선수의 획득 세트 수가 서로 마주 보는 두 개의 셀에 각각 적혀 있습니다.
예를 들어 가가가가 나나나에게 3:1로 승리했다면
가가가 행 × 나나나 열에는 3,
나나나 행 × 가가가 열에는 1이 적혀 있습니다.
따라서 경기 결과를 하나의 문자열로 만들지 말고,
각 셀의 위치와 숫자를 반환하세요.
승, 패, 순위, 동점자 세트득실 영역은 무시하세요.
경기 매트릭스 영역만 인식하세요.
숫자가 불명확하면 추측하지 말고 needsReview=true로 반환하세요.
반드시 JSON 형식으로만 응답하세요.`;

function extractOutputText(response) {
  if (typeof response.output_text === 'string') return response.output_text;
  const parts = [];
  for (const item of response.output ?? []) {
    for (const content of item.content ?? []) {
      if (content.type === 'output_text' && typeof content.text === 'string') parts.push(content.text);
      if (content.type === 'text' && typeof content.text === 'string') parts.push(content.text);
    }
  }
  return parts.join('\n');
}

function parseJsonObject(text) {
  const trimmed = String(text || '').trim();
  if (!trimmed) throw new Error('OpenAI Vision 응답이 비어 있습니다.');
  try {
    return JSON.parse(trimmed);
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('OpenAI Vision 응답에서 JSON을 찾을 수 없습니다.');
    return JSON.parse(match[0]);
  }
}

function isOpenAIVisionMockEnabled() {
  return ['1', 'true', 'yes', 'on'].includes(String(process.env.OPENAI_VISION_MOCK || '').toLowerCase());
}

function buildMockResult(participants) {
  const sampleScores = [
    [null, 3, 3, 1],
    [1, null, 2, 3],
    [0, 3, null, 3],
    [3, 1, 2, null],
  ];
  const cells = [];
  participants.forEach((rowPlayer, rowIndex) => {
    participants.forEach((columnPlayer, columnIndex) => {
      if (rowIndex === columnIndex) return;
      const score = sampleScores[rowIndex]?.[columnIndex] ?? 0;
      cells.push({
        rowPlayerName: rowPlayer.name,
        columnPlayerName: columnPlayer.name,
        rowIndex,
        columnIndex,
        score,
        confidence: columnIndex === participants.length - 1 ? 0.72 : 0.97,
        needsReview: columnIndex === participants.length - 1,
      });
    });
  });
  return { cells };
}

async function scanLeagueSheetWithOpenAIVision({ imageBuffer, mimeType, participants }) {
  if (isOpenAIVisionMockEnabled()) {
    return {
      engine: 'mock-openai-vision',
      result: buildMockResult(participants),
    };
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    const error = new Error('OPENAI_API_KEY가 설정되어 있지 않습니다.');
    error.code = 'OPENAI_API_KEY_MISSING';
    throw error;
  }

  const model = process.env.OPENAI_VISION_MODEL || 'gpt-4o-mini';
  const dataUrl = `data:${mimeType};base64,${imageBuffer.toString('base64')}`;
  const participantLines = participants.map((participant, index) => `${index + 1}. ${participant.name}`).join('\n');

  const body = {
    model,
    input: [
      {
        role: 'user',
        content: [
          {
            type: 'input_text',
            text: `${SYSTEM_PROMPT}

참가자 목록은 아래 순서와 같습니다.
${participantLines}

반환 형식:
{"cells":[{"rowPlayerName":"이름","columnPlayerName":"이름","rowIndex":0,"columnIndex":1,"score":3,"confidence":0.98,"needsReview":false}]}`,
          },
          {
            type: 'input_image',
            image_url: dataUrl,
          },
        ],
      },
    ],
    text: {
      format: {
        type: 'json_schema',
        name: 'woori_league_cells',
        schema: {
          type: 'object',
          additionalProperties: false,
          required: ['cells'],
          properties: {
            cells: {
              type: 'array',
              items: {
                type: 'object',
                additionalProperties: false,
                required: ['rowPlayerName', 'columnPlayerName', 'rowIndex', 'columnIndex', 'score', 'confidence', 'needsReview'],
                properties: {
                  rowPlayerName: { type: 'string' },
                  columnPlayerName: { type: 'string' },
                  rowIndex: { type: 'integer' },
                  columnIndex: { type: 'integer' },
                  score: { type: 'integer' },
                  confidence: { type: 'number' },
                  needsReview: { type: 'boolean' },
                },
              },
            },
          },
        },
        strict: true,
      },
    },
  };

  const response = await fetch(OPENAI_RESPONSES_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const responseBody = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(responseBody.error?.message || 'OpenAI Vision 요청에 실패했습니다.');
    error.code = 'OPENAI_VISION_FAILED';
    error.details = responseBody;
    throw error;
  }

  return {
    engine: model,
    result: parseJsonObject(extractOutputText(responseBody)),
  };
}

module.exports = {
  scanLeagueSheetWithOpenAIVision,
};
