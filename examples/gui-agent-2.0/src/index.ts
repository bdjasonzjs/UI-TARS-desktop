import { config } from 'dotenv';
import path from 'node:path';
config({ path: path.join(__dirname, '..', '.env.local') });

import { GUIAgent } from '@ui-tars-test/agent-sdk';
import { AIOHybridOperator } from '@ui-tars-test/operator-aio';
import { SYSTEM_PROMPT } from './constants';

const doubao = {
  id: process.env.DOUBAO_SEED_1_6!,
  provider: 'volcengine' as const,
  baseURL: process.env.ARK_BASE_URL!,
  apiKey: process.env.ARK_API_KEY!, // secretlint-disable-line
};

const operator = new AIOHybridOperator({
  baseURL: process.env.SANDBOX_URL!,
  timeout: 10000,
});

const guiAgent = new GUIAgent({
  operator,
  model: doubao,
  systemPrompt: SYSTEM_PROMPT,
});

async function main() {
  console.log('📦 Testing AIO Operator...');
  const response = await guiAgent.run({
    input: [{ type: 'text', text: 'Check the weather in Shanghai' }],
  });
  console.log('\n📝 Agent with AIO Operator Response:');
  console.log('================================================');
  console.log(response.content);
  console.log('================================================');
}

if (require.main === module) {
  main().catch((error) => {
    console.error('❌ Error in main:', error);
  });
}
