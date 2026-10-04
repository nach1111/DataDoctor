import {cleanCase,demoCase} from '@/fixtures/demoCase';
import {analyzeWithOptionalLlm} from '@/lib/pipeline/optionalLlm';
import {enrichPublicRecords} from '@/lib/pipeline/enrich';
import {ingestFixture} from '@/lib/pipeline/ingest';
export const runtime='nodejs';
export async function GET(request:Request){try{const fixture=new URL(request.url).searchParams.get('case')==='clean'?cleanCase:demoCase;return Response.json(await enrichPublicRecords(await analyzeWithOptionalLlm(ingestFixture(fixture))));}catch{return Response.json({error:'The demo case could not be analyzed.'},{status:500});}}
