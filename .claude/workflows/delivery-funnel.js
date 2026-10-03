export const meta = {
  name: 'delivery-funnel',
  description: 'Take one slice of work through design, build, implement, test, review and deploy, looping until the review panel approves',
  whenToUse: 'Every change to Chirunama. Pass args { slice, request, scratchDir } and optionally briefPath, buildReportPath, startAt ("design" | "build" | "implement") and maxRounds.',
  phases: [
    { title: 'Design', detail: 'designer writes the brief' },
    { title: 'Build', detail: 'builder lays schema, migrations, seed, shared modules' },
    { title: 'Implement', detail: 'implementer writes the feature, then fixes test failures and review findings' },
    { title: 'Test', detail: 'tester maps every acceptance criterion to a test and runs the whole suite' },
    { title: 'Review', detail: 'three reviewers with different lenses; blocking findings are independently verified' },
    { title: 'Deploy', detail: 'deployer runs release gates and writes release notes' },
  ],
}

// Every stage reads its own definition in .claude/agents/<stage>.md and follows it.
// Stages hand work to each other through report files in args.scratchDir (outside the repo).

const a = args || {}
if (!a.slice || !a.scratchDir) throw new Error('args.slice and args.scratchDir are required')
const slice = a.slice
const dir = a.scratchDir
const maxRounds = a.maxRounds || 3
const order = ['design', 'build', 'implement']
const startAt = order.indexOf(a.startAt || 'design')
if (startAt < 0) throw new Error('startAt must be design, build or implement')

const briefPath = a.briefPath || `${dir}/${slice}-brief.md`
const buildPath = a.buildReportPath || `${dir}/${slice}-build.md`
const stage = (name) =>
  `You are the \`${name}\` stage of the Chirunama delivery funnel. First read .claude/agents/${name}.md in the repository root and follow it exactly. Do not commit or push; the orchestrator commits after review.`

const TEST_SCHEMA = {
  type: 'object',
  properties: {
    all_green: { type: 'boolean', description: 'true only if every command passed and every criterion has a passing test' },
    commands: {
      type: 'array',
      items: { type: 'object', properties: { command: { type: 'string' }, result: { type: 'string' } }, required: ['command', 'result'] },
    },
    criteria: {
      type: 'array',
      items: {
        type: 'object',
        properties: { criterion: { type: 'string' }, tests: { type: 'string' }, status: { type: 'string', enum: ['pass', 'fail', 'missing'] } },
        required: ['criterion', 'tests', 'status'],
      },
    },
    product_bugs: {
      type: 'array',
      items: {
        type: 'object',
        properties: { summary: { type: 'string' }, location: { type: 'string' }, failing_test: { type: 'string' }, cause: { type: 'string' } },
        required: ['summary', 'location', 'failing_test', 'cause'],
      },
    },
    report_path: { type: 'string' },
  },
  required: ['all_green', 'commands', 'criteria', 'product_bugs', 'report_path'],
}

const REVIEW_SCHEMA = {
  type: 'object',
  properties: {
    verdict: { type: 'string', enum: ['APPROVE', 'CHANGES REQUIRED'] },
    findings: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          severity: { type: 'string', enum: ['blocker', 'major', 'minor'] },
          location: { type: 'string', description: 'file:line' },
          problem: { type: 'string' },
          scenario: { type: 'string', description: 'concrete inputs or state that lead to the wrong result' },
          fix: { type: 'string' },
        },
        required: ['severity', 'location', 'problem', 'scenario', 'fix'],
      },
    },
  },
  required: ['verdict', 'findings'],
}

const VERIFY_SCHEMA = {
  type: 'object',
  properties: {
    real: { type: 'boolean' },
    evidence: { type: 'string', description: 'what you read or ran that settles it' },
  },
  required: ['real', 'evidence'],
}

const LENSES = [
  { key: 'correctness', focus: 'Correctness against the brief: every acceptance criterion is truly met, edge and error paths from the brief behave as specified, data access is right (filters, ordering, N+1 queries, transactions), and the tests actually exercise the criteria.' },
  { key: 'security', focus: 'Security, privacy and trust: input validation, session/role/ownership checks in every server action and route handler (no IDOR), rate limits, open redirects, file access, secrets, what is stored (no Aadhaar numbers, no raw OTPs or tokens), who can see phone numbers, consent before WhatsApp messages, and badge wording (what was checked, by whom, when; humans approve badges).' },
  { key: 'craft', focus: 'Craft and users: matches surrounding conventions, no dead code or duplicate helpers, every new string in both en and te dictionaries, Telugu-first, mobile-first layouts (no horizontal scroll at 360px), accessible forms, sensible loading/empty/error states, no mention of the product spec, phases or internal planning anywhere in the repo.' },
]

const reports = { brief: briefPath, build: buildPath, implement: [], test: [], review: [] }

if (startAt <= 0) {
  phase('Design')
  await agent(`${stage('designer')}\n\nRequest for slice "${slice}":\n${a.request}\n\nSave your full brief to ${briefPath} (that path is outside the repository) and return only the path.`, { label: 'designer', phase: 'Design' })
}

if (startAt <= 1) {
  phase('Build')
  await agent(`${stage('builder')}\n\nThe design brief is at ${briefPath}. Save your full report to ${buildPath} and return only the path.`, { label: 'builder', phase: 'Build' })
}

phase('Implement')
let implPath = `${dir}/${slice}-implement-1.md`
await agent(`${stage('implementer')}\n\nThe design brief is at ${briefPath}; the builder's report is at ${buildPath}. Save your full report to ${implPath} and return only the path.`, { label: 'implementer', phase: 'Implement' })
reports.implement.push(implPath)

// Test, sending product bugs back to the implementer until the suite is green.
async function testUntilGreen(round) {
  let result = null
  for (let attempt = 1; attempt <= maxRounds; attempt++) {
    const testPath = `${dir}/${slice}-test-${round}.${attempt}.md`
    result = await agent(`${stage('tester')}\n\nThe design brief is at ${briefPath}; the builder's report is at ${buildPath}; the implementer's latest report is at ${reports.implement[reports.implement.length - 1]}. Save your full report to ${testPath} and set report_path to it.`, { label: `tester r${round}.${attempt}`, phase: 'Test', schema: TEST_SCHEMA })
    if (!result) throw new Error('tester returned nothing')
    reports.test.push(testPath)
    if (result.all_green && result.product_bugs.length === 0) return result
    if (attempt === maxRounds) break
    log(`Tests not green (round ${round}.${attempt}): ${result.product_bugs.length} product bug(s); back to the implementer`)
    implPath = `${dir}/${slice}-implement-fix-${round}.${attempt}.md`
    await agent(`${stage('implementer')}\n\nThe tester found these product bugs. Fix each at its root cause (do not change tests to make them pass), then rerun typecheck, lint and the relevant tests.\n\n${JSON.stringify(result.product_bugs, null, 2)}\n\nFull tester report: ${testPath}. Brief: ${briefPath}. Save your report to ${implPath} and return only the path.`, { label: `implementer fix r${round}.${attempt}`, phase: 'Implement' })
    reports.implement.push(implPath)
  }
  return result
}

let approved = false
let lastReview = null
for (let round = 1; round <= maxRounds; round++) {
  phase('Test')
  const tests = await testUntilGreen(round)
  if (!tests.all_green) {
    log(`Suite still red after ${maxRounds} attempts in round ${round}; stopping for a human`)
    return { status: 'tests-red', slice, reports, tests }
  }

  phase('Review')
  const reviews = (await parallel(LENSES.map((lens) => () =>
    agent(`${stage('reviewer')} You must not edit any file.\n\nYour lens for this review: ${lens.focus}\n\nThe design brief is at ${briefPath}. Reports: builder ${buildPath}; implementer ${reports.implement.join(', ')}; tester ${reports.test[reports.test.length - 1]}. Review the full slice diff against origin/main (git diff origin/main plus untracked files).`, { label: `review:${lens.key} r${round}`, phase: 'Review', schema: REVIEW_SCHEMA })
      .then((r) => r && { lens: lens.key, ...r })
  ))).filter(Boolean)

  const blocking = reviews.flatMap((r) => r.findings.filter((f) => f.severity !== 'minor').map((f) => ({ lens: r.lens, ...f })))
  // Each blocking finding gets an independent skeptic before it costs a fix round.
  const verified = (await parallel(blocking.map((f) => () =>
    agent(`You are verifying a code review finding on the Chirunama repository. Try to REFUTE it: read the code at ${f.location}, trace the scenario, run a quick check if useful. Do not edit files. Mark real=false only if you can show it does not happen.\n\n${JSON.stringify(f, null, 2)}`, { label: `verify ${f.location}`, phase: 'Review', schema: VERIFY_SCHEMA })
      .then((v) => v && { ...f, verification: v })
  ))).filter(Boolean)
  const confirmed = verified.filter((f) => f.verification.real)
  const minor = reviews.flatMap((r) => r.findings.filter((f) => f.severity === 'minor').map((f) => ({ lens: r.lens, ...f })))
  lastReview = { round, reviews: reviews.map((r) => ({ lens: r.lens, verdict: r.verdict, findings: r.findings.length })), confirmed, refuted: verified.length - confirmed.length, minor }
  reports.review.push(lastReview)
  log(`Review round ${round}: ${confirmed.length} confirmed blocking finding(s), ${verified.length - confirmed.length} refuted, ${minor.length} minor`)

  if (confirmed.length === 0) {
    approved = true
    break
  }
  if (round === maxRounds) break

  phase('Implement')
  implPath = `${dir}/${slice}-implement-review-${round}.md`
  await agent(`${stage('implementer')}\n\nThe review panel confirmed these blocking findings. Fix every one at its root cause. Also fix these minor findings where the fix is small and clearly right: ${JSON.stringify(minor)}\n\nBlocking:\n${JSON.stringify(confirmed, null, 2)}\n\nBrief: ${briefPath}. Save your report to ${implPath} and return only the path.`, { label: `implementer review-fix r${round}`, phase: 'Implement' })
  reports.implement.push(implPath)
}

if (!approved) {
  log('Review panel did not approve within the round limit; stopping for a human')
  return { status: 'changes-required', slice, reports, lastReview }
}

phase('Deploy')
const deployPath = `${dir}/${slice}-deploy.md`
const deploy = await agent(`${stage('deployer')}\n\nThe review panel approved slice "${slice}" (no confirmed blocking findings). Brief: ${briefPath}. Run the release gates and write the release checklist and notes. Keep deploy assets current only where they already exist or this slice's brief asks for them. Save your report to ${deployPath} and return a short summary: gates passed or failed, and anything blocking release.`, { label: 'deployer', phase: 'Deploy' })
return { status: 'approved', slice, reports: { ...reports, deploy: deployPath }, lastReview, deploy }
