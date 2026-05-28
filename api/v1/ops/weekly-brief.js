import { verifyAndAttachUser } from '../../../lib/middleware/auth.js';
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const authError = await verifyAndAttachUser(req);
  if (authError) {
    res.status(authError.statusCode);
    res.setHeader('Content-Type', 'application/json');
    return res.end(authError.body);
  }

  const { persona = 'executive', pipelineSummary = '', keyRisks = '' } = req.body || {};
  if (!pipelineSummary) return res.status(400).json({ error: 'Missing pipelineSummary' });

  try {
    const prompt = `Create a concise weekly brief draft for ${persona}.\nPipeline:\n${pipelineSummary}\nRisks:\n${keyRisks}\nReturn JSON {"subject":"","body":"","top3":["","",""]}`;
    const msg = await client.messages.create({
      model: 'claude-opus-4-7',
      max_tokens: 700,
      messages: [{ role: 'user', content: prompt }],
    });
    const text = msg.content.find((b) => b.type === 'text')?.text || '{}';
    const json = JSON.parse((text.match(/\{[\s\S]*\}/) || ['{}'])[0]);
    return res.status(200).json({ success: true, result: json });
  } catch {
    return res.status(500).json({ error: 'Brief generation failed' });
  }
}

