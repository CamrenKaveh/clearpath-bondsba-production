import { initializeApp } from 'firebase-admin/app';

initializeApp();

export { executeUnderwritingTrace } from './underwritingEngine';
export { sendPipelineStatusEmail } from './pipelineStatusEmail';
