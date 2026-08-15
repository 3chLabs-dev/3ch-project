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

const CELL_READING_RULES = `Read every non-diagonal score cell independently. Do not copy a value from another cell, infer a score from a win/loss/rank, or complete a result from its opposing cell.
The four large printed black squares at the corners of the game score matrix are fixed alignment markers. They are not scores. Use them to locate the complete score matrix, then ignore every printed number, label, line, and black square on the sheet. Read only the large handwritten integer inside each matrix cell.
A score may be any integer from 0 through 99. Two-digit scores such as 10, 11, 21, 31, and 99 are one complete cell value. Never split a two-digit score into separate cells or discard its second digit.
The 0 through 99 range is output validation only, not a clue for interpreting the handwriting. Transcribe the integer exactly as it appears. For example, if the handwriting appears to be 31, return 31; never change it to 21 or 30 merely because those values seem more plausible for a match.
Players sometimes draw a circle around a winning score, especially 2 in a best-of-3 match or 3 in a best-of-5 match. Treat the surrounding circle as emphasis only, not as the digit 0 and not as part of the score. A handwritten circled 2 or the symbol ② must be returned as score=2; a handwritten circled 3 or the symbol ③ must be returned as score=3. Apply the same rule to any clearly circled integer and return only the integer inside the circle.
Focus only on the handwritten integer inside each score cell, even when the paper is photographed at an angle or surrounded by blank space.
Set needsReview=false only when that exact handwritten integer is clearly visible. If a number is faint, obscured, cropped, outside 0 through 99, or ambiguous, return score=0, confidence at most 0.5, and needsReview=true. Do not report high confidence for a guessed number.`;

const STAR_GRID_READING_RULES = `This image contains an N by N league score grid. A five-point star marks the top-left score cell at rowIndex=0 and columnIndex=0. The star may be outlined or filled, hand-drawn or printed, and may be white, black, red, blue, or another contrasting color. Locate it by its five-point shape and grid position, not by color. Do not read participant names, divisions, rankings, or any other labels.
Starting at the star, identify the complete evenly spaced N by N score grid. Some cells may be printed with NO GAME because those players must not play each other. Ignore every NO GAME cell completely and never return it as a score. Return only cells that both belong to the supplied playable coordinate list and visibly contain a handwritten integer. Omit playable cells that are still blank. Each score is one integer from 0 through 99, and two-digit values such as 10, 21, 31, or 99 belong to one cell. Transcribe exactly what is visible. Players may circle a winning score; return only the integer inside the circle. The diagonal cells have no score. Read each cell independently; do not infer an opposing score or a winner.
The participant names provided below are server data only. Do not try to find them in the image. Copy the supplied name for each returned rowPlayerName and columnPlayerName according to rowIndex and columnIndex.`;

function buildStarGridReadingRules(participantCount, targetRegion) {
  if (targetRegion === 'all') return STAR_GRID_READING_RULES;
  const splitIndex = Math.ceil(participantCount / 2);
  if (targetRegion === 'upper-right') {
    return `This image is a cropped upper-right score block from a ${participantCount} by ${participantCount} league grid. It contains ${splitIndex} visible rows and ${participantCount - splitIndex} visible columns. Do not search for the missing parts of the full grid.
A five-point star marks the top-left visible score cell. That visible cell has full-grid coordinates rowIndex=0 and columnIndex=${splitIndex}. For every visible cell at local cropped position (r,c), return the FULL-GRID coordinates rowIndex=r and columnIndex=c+${splitIndex}. Never return local column indices 0 through ${splitIndex - 1} for this crop.
Read the cropped block in row-major order. Return only supplied playable coordinates that visibly contain a handwritten integer. Blank cells may be omitted. Each score is one integer from 0 through 99. A handwritten slash-like stroke may be the digit 1; inspect it carefully. Circled scores contain one integer. Do not infer scores from another cell, names, ranks, or match rules.
Participant names are server data only. Copy them according to the full-grid rowIndex and columnIndex.`;
  }
  return `This image is a cropped lower-left score block from a ${participantCount} by ${participantCount} league grid. It contains ${participantCount - splitIndex} visible rows and ${splitIndex} visible columns. Do not search for the missing parts of the full grid.
A five-point star marks the top-left visible score cell. That visible cell has full-grid coordinates rowIndex=${splitIndex} and columnIndex=0. For every visible cell at local cropped position (r,c), return the FULL-GRID coordinates rowIndex=r+${splitIndex} and columnIndex=c. Never return local row indices 0 through ${splitIndex - 1} for this crop.
Read the cropped block in row-major order. Return only supplied playable coordinates that visibly contain a handwritten integer. Blank cells may be omitted. Each score is one integer from 0 through 99. A handwritten slash-like stroke may be the digit 1; inspect it carefully. Circled scores contain one integer. Do not infer scores from another cell, names, ranks, or match rules.
Participant names are server data only. Copy them according to the full-grid rowIndex and columnIndex.`;
}

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

async function scanLeagueSheetWithOpenAIVision({ imageBuffer, mimeType, participants, mode = 'sheet', playableCells = null, targetRegion = 'all' }) {
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

  const model = process.env.OPENAI_VISION_MODEL || 'gpt-4.1-mini';
  const dataUrl = `data:${mimeType};base64,${imageBuffer.toString('base64')}`;
  const participantLines = participants.map((participant, index) => `${index + 1}. ${participant.name}`).join('\n');
  const expectedCellCount = participants.length * Math.max(0, participants.length - 1);
  const playableCellList = Array.isArray(playableCells) ? playableCells : null;
  const requestedCellCount = playableCellList?.length ?? expectedCellCount;
  const playableCoordinates = playableCellList
    ? playableCellList.map(({ rowIndex, columnIndex }) => `(${rowIndex},${columnIndex})`).join(' ')
    : '';

  const body = {
    model,
    ...(model.startsWith('gpt-4') ? { temperature: 0 } : {}),
    input: [
      {
        role: 'user',
        content: [
          {
            type: 'input_text',
            text: `${mode === 'star-grid' ? buildStarGridReadingRules(participants.length, targetRegion) : SYSTEM_PROMPT}

${mode === 'star-grid' ? '' : CELL_READING_RULES}

There are exactly ${participants.length} participants. ${mode === 'star-grid'
  ? `Only these ${requestedCellCount} coordinates are playable: ${playableCoordinates}. Ignore all other coordinates, including every NO GAME cell. Return only playable coordinates that visibly contain handwriting; blank playable cells may be omitted.`
  : `The completed result must contain exactly ${expectedCellCount} non-diagonal cells.`}
Inspect the grid in row-major order, then perform a second visual pass over every returned cell to verify both digits and cell positions before producing JSON. If handwriting exists but is faint or ambiguous, return score=0 and needsReview=true instead of guessing.

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
                  score: { type: 'integer', minimum: 0, maximum: 99 },
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

const PARTICIPANT_NAME_PROMPT = `You extract participant display names from screenshots of attendee lists.
Return only names rendered as the primary, prominent name text in each attendee row.
Ignore page titles, dates, counts, buttons, profile greetings, biographies, hashtags, badges, labels such as NEW or Premium Sponsor, and all smaller or gray secondary text.
Preserve Korean, Latin letters, digits, and meaningful nickname symbols exactly as displayed, but trim surrounding whitespace.
Read the list from top to bottom. Do not invent names and do not merge two rows.
If the same visible name appears more than once in this image, return every occurrence; the server will handle duplicates.
Respond only in the required JSON format.`;

async function scanParticipantNamesWithOpenAIVision({ imageBuffer, mimeType }) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    const error = new Error('OPENAI_API_KEY가 설정되어 있지 않습니다.');
    error.code = 'OPENAI_API_KEY_MISSING';
    throw error;
  }

  const model = process.env.OPENAI_VISION_MODEL || 'gpt-4.1-mini';
  const response = await fetch(OPENAI_RESPONSES_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      ...(model.startsWith('gpt-4') ? { temperature: 0 } : {}),
      input: [{
        role: 'user',
        content: [
          { type: 'input_text', text: PARTICIPANT_NAME_PROMPT },
          { type: 'input_image', image_url: `data:${mimeType};base64,${imageBuffer.toString('base64')}` },
        ],
      }],
      text: {
        format: {
          type: 'json_schema',
          name: 'participant_names',
          strict: true,
          schema: {
            type: 'object',
            additionalProperties: false,
            required: ['names'],
            properties: {
              names: {
                type: 'array',
                items: {
                  type: 'object',
                  additionalProperties: false,
                  required: ['name', 'confidence'],
                  properties: {
                    name: { type: 'string' },
                    confidence: { type: 'number', minimum: 0, maximum: 1 },
                  },
                },
              },
            },
          },
        },
      },
    }),
  });

  const responseBody = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(responseBody.error?.message || '참가자 이미지 인식에 실패했습니다.');
    error.code = 'OPENAI_VISION_FAILED';
    error.details = responseBody;
    throw error;
  }
  return { engine: model, result: parseJsonObject(extractOutputText(responseBody)) };
}

module.exports = {
  scanLeagueSheetWithOpenAIVision,
  scanParticipantNamesWithOpenAIVision,
};
