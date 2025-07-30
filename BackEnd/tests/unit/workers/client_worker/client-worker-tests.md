# ClientWorker Constructor Test Cases

## Business Logic Test Checklist

### ✅ **Basic Instance Creation**
- [ ] **Test: should create ClientWorker instance with valid parameters**
  - Setup: Provide valid `conf` and `ctx` objects
  - Action: Create new ClientWorker instance
  - Assert: Instance is created without throwing errors
  - Assert: Instance is instance of ClientWorker

### ✅ **Session Key Initialization**  
- [ ] **Test: should initialize sessionKey property to null**
  - Setup: Provide valid config
  - Action: Create new ClientWorker instance
  - Assert: `this.sessionKey` property exists
  - Assert: `this.sessionKey` is set to null
  - Assert: Session key properly initialized for authentication state

### ✅ **Facility Configuration**  
- [ ] **Test: should call setInitFacs with exactly 2 facilities**
  - Setup: Provide valid config, spy on setInitFacs method
  - Action: Create new ClientWorker instance
  - Assert: `setInitFacs` called once
  - Assert: `setInitFacs` called with array of length 2

- [ ] **Test: should configure storage facility with correct parameters**
  - Setup: Provide valid config, spy on setInitFacs method
  - Action: Create new ClientWorker instance
  - Assert: First facility array is `['fac', 'hp-svc-facs-store', null, 's0', { storeDir: './data/client' }, 0]`
  - Assert: Storage facility has priority `0` (first position)

- [ ] **Test: should configure network facility with correct parameters**
  - Setup: Provide valid config, spy on setInitFacs method
  - Action: Create new ClientWorker instance
  - Assert: Second facility array is `['fac', 'hp-svc-facs-net', 'net', 'default', { allowLocal: true }, 10]`
  - Assert: Network facility has priority `10` (second position)

- [ ] **Test: should configure storage facility with client-specific directory**
  - Setup: Provide valid config, spy on setInitFacs method
  - Action: Create new ClientWorker instance
  - Assert: Storage facility config object has `storeDir: './data/client'`
  - Assert: Storage facility name is `'s0'`
  - Assert: Storage facility type is `null` (no type specified)

- [ ] **Test: should configure network facility with allowLocal option**
  - Setup: Provide valid config, spy on setInitFacs method
  - Action: Create new ClientWorker instance
  - Assert: Network facility config object is `{ allowLocal: true }`
  - Assert: Network facility name is `'default'`
  - Assert: Network facility type is `'net'`

### ✅ **Operation Order**
- [ ] **Test: should call setInitFacs after session key initialization**
  - Setup: Provide valid config, spy on setInitFacs
  - Action: Create new ClientWorker instance
  - Assert: Session key initialization completes before setInitFacs
  - Assert: Both operations complete successfully

### ✅ **Facility Configuration Validation**
- [ ] **Test: should configure facilities with different priorities**
  - Setup: Provide valid config, spy on setInitFacs method
  - Action: Create new ClientWorker instance
  - Assert: Storage facility has priority `0`
  - Assert: Network facility has priority `10`
  - Assert: Storage facility configured before network facility

- [ ] **Test: should use client-specific storage directory**
  - Setup: Provide valid config, spy on setInitFacs method
  - Action: Create new ClientWorker instance
  - Assert: Storage facility storeDir is `'./data/client'` (not './data/auth' or './data/gateway')
  - Assert: Directory path is client-specific

---

## ClientWorker _start Method Test Cases

### ✅ **Network Facility Validation**
- [ ] **Test: should check net_default facility availability before starting**
  - Setup: Mock `this.net_default` as null/undefined
  - Action: Call `_start(cb)` method
  - Assert: Callback called with error "net_default facility not available"
  - Assert: No RPC client operations attempted

- [ ] **Test: should proceed when net_default facility is available**
  - Setup: Mock `this.net_default` with required methods
  - Action: Call `_start(cb)` method
  - Assert: Method execution continues after facility check
  - Assert: RPC client startup attempted

### ✅ **RPC Client Startup**
- [ ] **Test: should start RPC client when net_default facility is available**
  - Setup: Mock `this.net_default` with `startRpc` method
  - Action: Call `_start(cb)` method
  - Assert: `this.net_default.startRpc()` called once
  - Assert: Method execution continues after RPC client start

- [ ] **Test: should handle RPC client startup failure**
  - Setup: Mock `this.net_default.startRpc` to throw error
  - Action: Call `_start(cb)` method
  - Assert: Callback called with error from startRpc
  - Assert: No subsequent operations attempted

### ✅ **Lookup Service Management**
- [ ] **Test: should start lookup service after RPC client**
  - Setup: Mock `this.net_default.startLookup` method
  - Action: Call `_start(cb)` method
  - Assert: `this.net_default.startLookup()` called once
  - Assert: Method called after RPC client startup

- [ ] **Test: should handle missing startLookup method**
  - Setup: Mock `this.net_default` without `startLookup` method
  - Action: Call `_start(cb)` method
  - Assert: Error thrown or graceful handling when method missing
  - Assert: Appropriate error response

### ✅ **Method Execution Flow**
- [ ] **Test: should execute operations in correct sequence**
  - Setup: Mock all net_default methods with spies
  - Action: Call `_start(cb)` method
  - Assert: Facility check performed first
  - Assert: `startRpc` called before `startLookup`
  - Assert: Callback called after all operations

- [ ] **Test: should call callback without error on successful completion**
  - Setup: Mock all net_default methods to succeed
  - Action: Call `_start(cb)` method
  - Assert: Callback called once
  - Assert: Callback called with no error parameter

- [ ] **Test: should handle callback not provided**
  - Setup: Mock all net_default methods to succeed
  - Action: Call `_start()` without callback parameter
  - Assert: Method executes without throwing errors
  - Assert: No callback-related errors occur

### ✅ **Error Handling**
- [ ] **Test: should handle net_default facility completely missing**
  - Setup: Set `this.net_default` to null
  - Action: Call `_start(cb)` method
  - Assert: Callback called with "net_default facility not available" error
  - Assert: No method calls attempted on null object

- [ ] **Test: should handle net_default facility undefined**
  - Setup: Set `this.net_default` to undefined
  - Action: Call `_start(cb)` method
  - Assert: Callback called with "net_default facility not available" error
  - Assert: No method calls attempted on undefined object

---

## ClientWorker Delegation Methods Test Cases

### ✅ **sendRequest Method**
- [ ] **Test: should delegate to ClientHelper.sendRequest with correct parameters**
  - Setup: Mock `ClientHelper.sendRequest` method
  - Action: Call `sendRequest(inputPrompt)` with test prompt
  - Assert: `ClientHelper.sendRequest` called with `this` and `inputPrompt`
  - Assert: Method returns promise from ClientHelper.sendRequest

- [ ] **Test: should handle inputPrompt parameter correctly**
  - Setup: Mock `ClientHelper.sendRequest`, test with various prompt types
  - Action: Call `sendRequest(prompt)` with different prompt values
  - Assert: Prompt parameter passed through unchanged to ClientHelper
  - Assert: Method maintains async behavior

- [ ] **Test: should handle null/undefined inputPrompt**
  - Setup: Mock `ClientHelper.sendRequest`
  - Action: Call `sendRequest(null)` and `sendRequest(undefined)`
  - Assert: Parameters passed through to ClientHelper unchanged
  - Assert: No parameter validation performed at worker level

### ✅ **registerUser Method**
- [ ] **Test: should delegate to ClientHelper.registerUser with correct parameters**
  - Setup: Mock `ClientHelper.registerUser` method
  - Action: Call `registerUser(email, password)` with test credentials
  - Assert: `ClientHelper.registerUser` called with `this`, `email`, `password`
  - Assert: Method returns promise from ClientHelper.registerUser

- [ ] **Test: should handle email and password parameters correctly**
  - Setup: Mock `ClientHelper.registerUser`, test with various credential types
  - Action: Call `registerUser(email, password)` with different values
  - Assert: Email and password parameters passed through unchanged
  - Assert: Method maintains async behavior

- [ ] **Test: should handle missing email or password parameters**
  - Setup: Mock `ClientHelper.registerUser`
  - Action: Call `registerUser()`, `registerUser(email)`, `registerUser(null, password)`
  - Assert: Parameters passed through to ClientHelper unchanged
  - Assert: No parameter validation performed at worker level

### ✅ **loginUser Method**
- [ ] **Test: should delegate to ClientHelper.loginUser with correct parameters**
  - Setup: Mock `ClientHelper.loginUser` method
  - Action: Call `loginUser(email, password)` with test credentials
  - Assert: `ClientHelper.loginUser` called with `this`, `email`, `password`
  - Assert: Method returns promise from ClientHelper.loginUser

- [ ] **Test: should handle email and password parameters correctly**
  - Setup: Mock `ClientHelper.loginUser`, test with various credential types
  - Action: Call `loginUser(email, password)` with different values
  - Assert: Email and password parameters passed through unchanged
  - Assert: Method maintains async behavior

### ✅ **logout Method**
- [ ] **Test: should delegate to ClientHelper.logout with correct parameters**
  - Setup: Mock `ClientHelper.logout` method
  - Action: Call `logout()` method
  - Assert: `ClientHelper.logout` called with `this` parameter
  - Assert: Method returns result from ClientHelper.logout

- [ ] **Test: should handle logout with no parameters**
  - Setup: Mock `ClientHelper.logout`
  - Action: Call `logout()` method
  - Assert: Only worker instance passed to ClientHelper
  - Assert: No additional parameters passed

### ✅ **verifySession Method**
- [ ] **Test: should delegate to ClientHelper.verifySession with correct parameters**
  - Setup: Mock `ClientHelper.verifySession` method
  - Action: Call `verifySession()` method
  - Assert: `ClientHelper.verifySession` called with `this` parameter
  - Assert: Method returns promise from ClientHelper.verifySession

- [ ] **Test: should handle session verification as async operation**
  - Setup: Mock `ClientHelper.verifySession` to return promise
  - Action: Call `verifySession()` method
  - Assert: Method returns promise
  - Assert: Async behavior maintained through delegation

### ✅ **getApiToken Method**
- [ ] **Test: should delegate to ClientHelper.getApiToken with correct parameters**
  - Setup: Mock `ClientHelper.getApiToken` method
  - Action: Call `getApiToken()` method
  - Assert: `ClientHelper.getApiToken` called with `this` parameter
  - Assert: Method returns result from ClientHelper.getApiToken

- [ ] **Test: should handle API token retrieval as synchronous operation**
  - Setup: Mock `ClientHelper.getApiToken` to return value
  - Action: Call `getApiToken()` method
  - Assert: Method returns value directly
  - Assert: Synchronous behavior maintained through delegation

---

## ClientWorker stop Method Test Cases

### ✅ **Parent Stop Integration**
- [ ] **Test: should call parent stop method**
  - Setup: Mock `super.stop` method
  - Action: Call `stop()` method
  - Assert: `super.stop()` called once
  - Assert: Parent cleanup operations performed

- [ ] **Test: should handle parent stop method failure**
  - Setup: Mock `super.stop` to throw error
  - Action: Call `stop()` method
  - Assert: Error from parent stop is not caught
  - Assert: Error propagated to caller

### ✅ **Cleanup Operations**
- [ ] **Test: should perform stop operation without additional cleanup**
  - Setup: Mock `super.stop` method
  - Action: Call `stop()` method
  - Assert: Only parent stop method called
  - Assert: No additional ClientWorker-specific cleanup performed

- [ ] **Test: should complete stop operation successfully**
  - Setup: Mock `super.stop` to succeed
  - Action: Call `stop()` method
  - Assert: Method completes without errors
  - Assert: Stop operation finishes cleanly

---

## Edge Cases and Error Scenarios

### ✅ **Constructor Parameter Validation**
- [ ] **Test: should handle null conf parameter**
  - Setup: Pass null as conf parameter
  - Action: Create new ClientWorker instance
  - Assert: Constructor handles null gracefully or throws expected error
  - Assert: No unexpected crashes

- [ ] **Test: should handle undefined conf parameter**
  - Setup: Pass undefined as conf parameter
  - Action: Create new ClientWorker instance
  - Assert: Constructor handles undefined gracefully or throws expected error
  - Assert: No unexpected crashes

- [ ] **Test: should handle null ctx parameter**
  - Setup: Pass null as ctx parameter
  - Action: Create new ClientWorker instance
  - Assert: Constructor handles null gracefully or throws expected error
  - Assert: No unexpected crashes

- [ ] **Test: should handle undefined ctx parameter**
  - Setup: Pass undefined as ctx parameter
  - Action: Create new ClientWorker instance
  - Assert: Constructor handles undefined gracefully or throws expected error
  - Assert: No unexpected crashes

- [ ] **Test: should handle empty conf object**
  - Setup: Pass empty object `{}` as conf parameter
  - Action: Create new ClientWorker instance
  - Assert: Constructor handles empty conf gracefully
  - Assert: Facility configuration still works

- [ ] **Test: should handle empty ctx object**
  - Setup: Pass empty object `{}` as ctx parameter
  - Action: Create new ClientWorker instance
  - Assert: Constructor handles empty ctx gracefully
  - Assert: Facility configuration still works

### ✅ **_start Method Edge Cases**
- [ ] **Test: should handle partial net_default facility setup**
  - Setup: Mock `this.net_default` with missing methods
  - Action: Call `_start(cb)` method
  - Assert: Method handles missing methods gracefully
  - Assert: Appropriate error handling for missing functionality

- [ ] **Test: should handle startRpc returning non-promise**
  - Setup: Mock `startRpc` to return non-promise value
  - Action: Call `_start(cb)` method
  - Assert: Method handles non-async startRpc gracefully
  - Assert: Execution continues appropriately

- [ ] **Test: should handle startLookup throwing synchronous error**
  - Setup: Mock `startLookup` to throw immediate error
  - Action: Call `_start(cb)` method
  - Assert: Error caught and passed to callback
  - Assert: No unhandled errors thrown

### ✅ **Delegation Method Edge Cases**
- [ ] **Test: should handle ClientHelper methods not available**
  - Setup: Mock ClientHelper with missing methods
  - Action: Call delegation methods (sendRequest, registerUser, etc.)
  - Assert: Methods handle missing ClientHelper methods gracefully
  - Assert: Appropriate error handling for missing dependencies

- [ ] **Test: should handle ClientHelper returning null/undefined**
  - Setup: Mock ClientHelper methods to return null/undefined
  - Action: Call delegation methods
  - Assert: Return values passed through unchanged
  - Assert: No additional processing of return values

- [ ] **Test: should handle ClientHelper throwing errors**
  - Setup: Mock ClientHelper methods to throw errors
  - Action: Call delegation methods
  - Assert: Errors propagated from ClientHelper unchanged
  - Assert: No error handling performed at worker level

### ✅ **Configuration Integrity**
- [ ] **Test: should maintain facility configuration immutability**
  - Setup: Spy on setInitFacs, capture passed arrays
  - Action: Create new ClientWorker instance, modify captured arrays
  - Assert: Original facility configuration not affected by external modifications
  - Assert: Configuration integrity maintained

- [ ] **Test: should use exact facility configuration values**
  - Setup: Spy on setInitFacs method
  - Action: Create new ClientWorker instance
  - Assert: Storage facility storeDir is exactly `'./data/client'`
  - Assert: Network facility config is exactly `{ allowLocal: true }`
  - Assert: No additional or missing properties

---

## Test Setup Requirements

### Mocks Needed
- **setInitFacs**: Spy to capture and verify facility configuration parameters
- **net_default**: Mock object with startRpc and startLookup methods
- **ClientHelper**: Mock object with all delegation methods (sendRequest, registerUser, loginUser, logout, verifySession, getApiToken)
- **super.stop**: Mock to verify parent class method calls

### Test Data
- **Valid conf**: `{ env: 'development', root: process.cwd() }`
- **Valid ctx**: `{ wtype: 'client-worker', env: 'dev', root: process.cwd() }`
- **Test prompt**: `"Test AI prompt for processing"`
- **Test credentials**: `{ email: "test@example.com", password: "testpass123" }`

### Test Utilities
- **createValidConfig()**: Return `{ env: 'development', root: process.cwd() }`
- **createValidContext()**: Return `{ wtype: 'client-worker', env: 'dev', root: process.cwd() }`
- **resetMocks()**: Reset all spies and mocks between tests
- **createMockNetFacility()**: Return mock net_default with required methods

### Expected Values for Assertions
- **Storage facility array**: `['fac', 'hp-svc-facs-store', null, 's0', { storeDir: './data/client' }, 0]`
- **Network facility array**: `['fac', 'hp-svc-facs-net', 'net', 'default', { allowLocal: true }, 10]`
- **Session key initial value**: `null`

---

## Test Progress Tracking

**Total Test Cases**: 48 (12 constructor + 9 _start + 18 delegation + 3 stop + 6 edge cases)  
**Completed**: 0/48  
**Remaining**: 48/48  
**Status**: ⚠️ **READY TO IMPLEMENT**

### Test Categories Summary
- **Constructor Tests**: 12 test cases ⚠️ **PENDING**
- **_start Method**: 9 test cases ⚠️ **PENDING**
- **Delegation Methods**: 18 test cases ⚠️ **PENDING**
- **stop Method**: 3 test cases ⚠️ **PENDING**
- **Edge Cases**: 6 test cases ⚠️ **PENDING**

### Test Results Summary
- [ ] **0 tests passing**
- [ ] **0 assertions passing**  
- [ ] **Business logic to be covered**
- [ ] **No test failures yet**

### Status Legend
- [ ] Not started
- [⚠️] In progress  
- [✅] Completed and verified
- [❌] Failed/needs fixing

---

## Implementation Guidelines

### What TO Test
✅ **Constructor Business Logic**
- setInitFacs called with correct parameters
- Storage facility configured with client-specific directory
- Network facility configured with allowLocal option
- Session key initialization
- Facility priorities and order

✅ **_start Method Business Logic**
- Net facility availability validation
- RPC client startup sequencing
- Lookup service initialization
- Error handling and callback management

✅ **Delegation Methods Business Logic**
- Correct delegation to ClientHelper methods
- Parameter passthrough integrity
- Return value passthrough
- Error propagation

✅ **stop Method Business Logic**
- Parent stop method integration
- Cleanup completion

### What NOT to Test
❌ **Base Class Functionality**
- `super(conf, ctx)` behavior
- `this.init()` behavior
- Base class properties or methods

❌ **External Library Behavior**
- ClientHelper method implementations
- hp-svc-facs-store behavior
- hp-svc-facs-net behavior

❌ **Logging and Console Output**
- console.log statements
- Debug output
- Emoji or formatting

❌ **Infrastructure Concerns**
- Actual network communication
- Actual RPC operations
- File system operations

### Test Implementation Strategy
1. **Mock External Dependencies**: Mock ClientHelper methods and net facility
2. **Spy on Method Calls**: Use spies to verify method calls and parameters
3. **Validate Parameters**: Assert exact parameter values passed to mocked methods
4. **Test Independence**: Each test should be isolated and not depend on others
5. **Simple Assertions**: Keep assertions straightforward and focused on business logic
6. **Readable Tests**: Use descriptive test names and clear assertion messages

---

## Implementation Priority

### Phase 1: Core Constructor Logic (12 tests)
- Basic instance creation and session key initialization
- Facility configuration validation
- Operation sequencing

### Phase 2: _start Method Logic (9 tests)
- Network facility validation
- RPC client and lookup service startup
- Error handling and callback management

### Phase 3: Delegation Methods Logic (18 tests)
- All delegation methods parameter passing
- Return value handling
- Error propagation

### Phase 4: Stop Method and Edge Cases (9 tests)
- Stop method integration
- Constructor parameter edge cases
- Method failure scenarios

---

## Key Implementation Notes

### ClientWorker-Specific Characteristics
- **Session Management**: Session key initialization and management
- **Client-Specific Storage**: Uses `./data/client` directory
- **Network Configuration**: Includes `allowLocal: true` option
- **Pure Delegation**: Most methods are simple delegations to ClientHelper
- **No RPC Server**: Only starts RPC client, not server (unlike other workers)
- **No Service Announcement**: Does not announce itself to DHT

### Testing Philosophy
Following the established pattern from AuthWorker tests:
- **Simple and Plain**: Easy to read and understand
- **Business Logic Focus**: Test only what ClientWorker controls
- **Mock External Dependencies**: Don't test library behavior  
- **Independent Tests**: Each test stands alone
- **Clear Assertions**: Straightforward pass/fail criteria
- **Comprehensive Coverage**: All business logic paths tested

### Success Criteria
- All facility configurations verified with exact parameter matching
- Session key initialization tested properly
- Constructor completes without testing base class behavior
- _start method flow validated with error handling
- All delegation methods tested for parameter integrity
- Edge cases handled gracefully
- Tests are "brainless and dumb" - simple, clear, and focused
- Zero dependencies on actual network operations or ClientHelper implementations
- Complete coverage of ClientWorker business logic

**✅ READY FOR IMPLEMENTATION - ALL TEST CASES DOCUMENTED**