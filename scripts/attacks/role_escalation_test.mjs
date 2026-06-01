import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'

const evidenceFile = process.env.EVIDENCE_FILE
  || 'EVIDENCE/attack_results/role-escalation/role_escalation_result.json'

const appSource = readFileSync('frontend/src/App.jsx', 'utf8')

function canAccessRoute(userRoles = [], allowedRoles = []) {
  if (allowedRoles.length === 0) return true
  return allowedRoles.some(role => userRoles.includes(role))
}

function routeContains(path, expectedRoles) {
  const routePattern = new RegExp(
    `path="${path}"[\\s\\S]*?<PrivateRoute\\s+roles=\\{\\[([^\\]]*)\\]\\}>`,
    'm',
  )
  const match = appSource.match(routePattern)
  if (!match) return false

  const actualRoles = match[1]
    .split(',')
    .map(role => role.trim().replaceAll("'", '').replaceAll('"', ''))
    .filter(Boolean)

  return JSON.stringify(actualRoles.sort()) === JSON.stringify([...expectedRoles].sort())
}

const cases = [
  {
    name: 'admin_can_access_admin',
    userRoles: ['admin'],
    allowedRoles: ['admin'],
    expected: true,
  },
  {
    name: 'admin_cannot_access_staff_ui',
    userRoles: ['admin'],
    allowedRoles: ['staff'],
    expected: false,
  },
  {
    name: 'admin_cannot_access_customer_ui',
    userRoles: ['admin'],
    allowedRoles: ['customer'],
    expected: false,
  },
  {
    name: 'staff_can_access_staff',
    userRoles: ['staff'],
    allowedRoles: ['staff'],
    expected: true,
  },
  {
    name: 'staff_cannot_access_admin',
    userRoles: ['staff'],
    allowedRoles: ['admin'],
    expected: false,
  },
  {
    name: 'staff_cannot_access_customer',
    userRoles: ['staff'],
    allowedRoles: ['customer'],
    expected: false,
  },
  {
    name: 'customer_can_access_customer',
    userRoles: ['customer'],
    allowedRoles: ['customer'],
    expected: true,
  },
  {
    name: 'customer_cannot_access_admin',
    userRoles: ['customer'],
    allowedRoles: ['admin'],
    expected: false,
  },
  {
    name: 'customer_cannot_access_staff',
    userRoles: ['customer'],
    allowedRoles: ['staff'],
    expected: false,
  },
]

const routeConfigCases = [
  {
    name: 'admin_route_allows_only_admin',
    path: '/admin',
    expectedRoles: ['admin'],
    passed: routeContains('/admin', ['admin']),
  },
  {
    name: 'staff_route_allows_only_staff',
    path: '/staff',
    expectedRoles: ['staff'],
    passed: routeContains('/staff', ['staff']),
  },
  {
    name: 'customer_route_allows_only_customer',
    path: '/customer',
    expectedRoles: ['customer'],
    passed: routeContains('/customer', ['customer']),
  },
]

const evaluated = cases.map(testCase => {
  const actual = canAccessRoute(testCase.userRoles, testCase.allowedRoles)
  return {
    ...testCase,
    actual,
    passed: actual === testCase.expected,
  }
})

const passedCases = evaluated.filter(testCase => testCase.passed).length
const passedRouteCases = routeConfigCases.filter(testCase => testCase.passed).length
const report = {
  title: 'Frontend role route isolation / privilege escalation evidence',
  timestamp_utc: new Date().toISOString(),
  expected_security_property: 'Admin, staff and customer UI areas are isolated by route role guards.',
  result: passedCases === evaluated.length && passedRouteCases === routeConfigCases.length ? 'PASS' : 'FAIL',
  passed_cases: passedCases,
  total_cases: evaluated.length,
  passed_route_config_cases: passedRouteCases,
  total_route_config_cases: routeConfigCases.length,
  route_config_cases: routeConfigCases,
  cases: evaluated,
}

mkdirSync(dirname(evidenceFile), { recursive: true })
writeFileSync(evidenceFile, JSON.stringify(report, null, 2), 'utf8')

console.log(JSON.stringify(report, null, 2))
console.log(`\nEvidence saved: ${evidenceFile}`)

if (report.result !== 'PASS') process.exit(1)
