# Test Plan

**Project:** RescueMe Web Platform  
**Test Type:** Unit Testing  
**Total Test Cases:** 181  
**Test Suites:** 13  
**Framework:** Jest (NestJS)

---

| ID | Test Case Description | Module | Priority | Expected Result |
|---|---|---|---|---|
| TP-001 | Register a new user with valid email, password, and name | Auth | High | New user account is created; access token and user data are returned; `requiresProfileCompletion` is `true` |
| TP-002 | Register with an email address that already exists in the system | Auth | High | `ConflictException` is thrown |
| TP-003 | Login with valid email credentials for a profile-completed user | Auth | High | Access token and refresh token are returned; `requiresProfileCompletion` is `false` |
| TP-004 | Login with an email address that is not registered | Auth | High | `UnauthorizedException` is thrown |
| TP-005 | Login with email for an account registered via Google OAuth | Auth | High | `BadRequestException` is thrown |
| TP-006 | Login attempt for a banned/suspended user account | Auth | High | `ForbiddenException` is thrown |
| TP-007 | Login with a correct email but an incorrect password | Auth | High | `UnauthorizedException` is thrown |
| TP-008 | Login with a valid Google ID token for a new (non-existing) account | Auth | High | New user is created; `isNewUser` is `true` |
| TP-009 | Login with a valid Google ID token for an existing Google account | Auth | High | Existing user is logged in; `lastLogin` timestamp is updated; `isNewUser` is `false` |
| TP-010 | Request password reset email for a valid registered email address | Auth | High | Password reset email is sent; success message is returned |
| TP-011 | Request password reset for an email address not registered in the system | Auth | High | `NotFoundException` is thrown |
| TP-012 | Request password reset for an account registered via Google OAuth | Auth | High | `BadRequestException` is thrown |
| TP-013 | Reset password using a valid, non-expired, unused reset token | Auth | High | Password is updated; all active sessions are invalidated |
| TP-014 | Reset password using a token that has passed its expiration time | Auth | High | `BadRequestException` is thrown |
| TP-015 | Reset password using a token that has already been used | Auth | High | `BadRequestException` is thrown |
| TP-016 | Change password successfully with a correct current password | Auth | High | Password is updated; success message is returned |
| TP-017 | Change password with an incorrect current (old) password provided | Auth | High | `UnauthorizedException` is thrown |
| TP-018 | Logout a user by deleting the active session | Auth | Medium | Session is deleted from the database; success message is returned |
| TP-019 | Select a role for a user whose profile has not yet been completed | Auth | High | User role is updated successfully; profile completion flag is set |
| TP-020 | Attempt to select a role for a user whose profile is already completed | Auth | High | `BadRequestException` is thrown |
| TP-021 | Update user profile with valid data for a USER role | User | High | Profile is updated; `hashedPassword` is not exposed in the response |
| TP-022 | Attempt to call `updateProfile` with `PROVIDER` role (wrong role) | User | High | `ForbiddenException` is thrown |
| TP-023 | Attempt to update profile for a user ID that does not exist | User | High | `NotFoundException` is thrown |
| TP-024 | Update profile including a vehicles array to sync primary vehicle columns | User | Medium | `vehicleType` and `licensePlate` columns are updated on the user record |
| TP-025 | Update profile with an empty vehicles array to clear vehicle data | User | Medium | `vehicleType` and `licensePlate` columns are set to `null` |
| TP-026 | Update user avatar with a valid new image URL | User | Medium | Avatar URL is updated; `hashedPassword` is not exposed in the response |
| TP-027 | Attempt to update avatar for a user ID that does not exist | User | Medium | `NotFoundException` is thrown |
| TP-028 | Retrieve the profile of an existing user | User | High | Sanitized user profile is returned; `hashedPassword` is not exposed |
| TP-029 | Attempt to retrieve the profile of a non-existent user | User | High | `NotFoundException` is thrown |
| TP-030 | Update provider profile with full valid data | Provider | High | Profile is updated successfully; `hashedPassword` is not exposed in the response |
| TP-031 | Attempt to call provider `updateProfile` with `USER` role (wrong role) | Provider | High | `ForbiddenException` is thrown |
| TP-032 | Update provider profile as BUSINESS type without providing `businessName` | Provider | High | `ForbiddenException` is thrown |
| TP-033 | Update provider profile without providing any rescue vehicles | Provider | High | `ForbiddenException` is thrown |
| TP-034 | Retrieve the profile of an existing provider | Provider | High | Sanitized provider profile is returned; `hashedPassword` is not exposed |
| TP-035 | Attempt to retrieve the profile of a non-existent provider | Provider | High | `NotFoundException` is thrown |
| TP-036 | Submit verification for a provider with an incomplete profile | Provider | High | Returns `success: false` with a list of `missingFields` |
| TP-037 | Submit verification for a provider ID that does not exist | Provider | High | `NotFoundException` is thrown |
| TP-038 | Submit verification for a user who does not have the PROVIDER role | Provider | High | `ForbiddenException` is thrown |
| TP-039 | Update provider online status to `true` (going online) | Provider | High | Online status is updated; updated record is returned |
| TP-040 | Attempt to update online status for a provider that does not exist | Provider | High | `NotFoundException` is thrown |
| TP-041 | Change provider password when the current password is correct | Provider | High | Password is changed; success response is returned |
| TP-042 | Change provider password when the current password is incorrect | Provider | High | `BadRequestException` is thrown |
| TP-043 | Update provider current location when the provider is online | Provider | Medium | Location coordinates are persisted via `user.update` |
| TP-044 | Attempt to update provider location when the provider is offline | Provider | Medium | Operation returns `success: false` silently without throwing |
| TP-045 | Retrieve provider history and dashboard statistics for a given number of days | Provider | Medium | Statistics object is returned with defined properties |
| TP-046 | Create a rescue request for an existing user with valid incident data | RescueRequest | High | Request record is created; returned object has the expected ID |
| TP-047 | Attempt to create a rescue request for a user ID that does not exist | RescueRequest | High | `NotFoundException` is thrown |
| TP-048 | Retrieve all rescue requests belonging to a specific user | RescueRequest | High | Array of request objects is returned |
| TP-049 | Retrieve a specific rescue request by ID for the owning user | RescueRequest | High | Full request detail is returned with the correct ID |
| TP-050 | Attempt to retrieve a rescue request that does not exist | RescueRequest | High | `NotFoundException` is thrown |
| TP-051 | Cancel a rescue request that is currently in `SEARCHING` status | RescueRequest | High | Request status is updated to `CANCELLED` |
| TP-052 | Attempt to cancel a rescue request that is already in `COMPLETED` status | RescueRequest | High | An error is thrown indicating the request cannot be cancelled in its current status |
| TP-053 | Provider declines a request that was `ASSIGNED` to them | RescueRequest | High | Request is returned to searching; response object is defined |
| TP-054 | Attempt to decline a rescue request that does not exist | RescueRequest | High | `NotFoundException` is thrown |
| TP-055 | Create a quote for an eligible provider on an open-window request | RescueRequest | High | Quote is created with `PENDING` status |
| TP-056 | Respond to a quote for a rescue request that does not exist | RescueRequest | High | `NotFoundException` is thrown |
| TP-057 | Submit a review for a rescue request that does not exist | RescueRequest | High | `NotFoundException` is thrown |
| TP-058 | Submit a review for a request that has not yet reached `COMPLETED` status | RescueRequest | High | `BadRequestException` is thrown |
| TP-059 | Start navigation for a rescue request that does not exist | RescueRequest | High | `NotFoundException` is thrown |
| TP-060 | Retrieve incident map data for all rescue requests | RescueRequest | Medium | An array is returned containing incident data objects |
| TP-061 | Create a payment for a rescue request that does not exist | RescueRequest | High | `NotFoundException` is thrown |
| TP-062 | Confirm payment sent for a rescue request that does not exist | RescueRequest | High | `NotFoundException` is thrown |
| TP-063 | Run the background job to check and expire stale rescue requests | RescueRequest | Medium | Result object includes a defined `totalProcessed` count |
| TP-064 | Ensure a provider wallet is created (upserted) when it does not yet exist | Wallet | High | Wallet record is created; `providerId` matches the input |
| TP-065 | Retrieve a provider wallet by its wallet ID | Wallet | High | Wallet object with the correct ID is returned |
| TP-066 | Attempt to retrieve a wallet using a wallet ID that does not exist | Wallet | High | `NotFoundException` is thrown |
| TP-067 | Retrieve a provider wallet using the provider's user ID | Wallet | High | Wallet object with the correct `providerId` is returned |
| TP-068 | Attempt to retrieve a wallet for a provider who has no wallet | Wallet | High | `NotFoundException` is thrown |
| TP-069 | Credit a wallet with a COMPLETED transaction; adds to available balance | Wallet | High | Transaction status is `COMPLETED`; `availableBalance` is incremented |
| TP-070 | Credit a wallet with a PENDING transaction; adds to pending balance | Wallet | High | Transaction status is `PENDING`; `pendingBalance` is incremented |
| TP-071 | Attempt to credit a wallet with a non-positive (zero) amount | Wallet | High | `BadRequestException` is thrown |
| TP-072 | Debit a wallet with sufficient available balance | Wallet | High | Debit transaction is created; `availableBalance` is decremented |
| TP-073 | Attempt to debit a wallet when available balance is insufficient | Wallet | High | `BadRequestException` is thrown |
| TP-074 | Attempt to debit a wallet with a negative amount | Wallet | High | `BadRequestException` is thrown |
| TP-075 | Initiate a withdrawal request with sufficient available balance | Wallet | High | Withdrawal transaction is created with `PENDING` status; balance is reserved |
| TP-076 | Attempt to initiate a withdrawal when available balance is insufficient | Wallet | High | `BadRequestException` is thrown |
| TP-077 | Process a valid SePay provider top-up webhook and credit the wallet | Wallet | High | Webhook is processed; `success` is `true`; wallet balance is increased |
| TP-078 | Process a SePay webhook with a duplicate `sepayId` (idempotency check) | Wallet | High | Returns a response with message `'Already processed'` |
| TP-079 | Process a SePay webhook with an invalid API key in the header | Wallet | High | `UnauthorizedException` is thrown |
| TP-080 | Process a SePay webhook whose content does not match any known transfer code | Wallet | Medium | Returns `success: true` with a message containing `'No matching'` |
| TP-081 | Process a SePay webhook with a non-`in`/`out` transfer type (e.g., `pending`) | Wallet | Medium | Returns `success: true`; no wallet modification is performed |
| TP-082 | Initiate a new provider top-up transaction for the first time | Wallet | High | New topup record is created; `transferCode` is returned; `isReuse` is `false` |
| TP-083 | Initiate a top-up when an identical PENDING topup already exists (reuse) | Wallet | Medium | Existing topup is reused; `isReuse` is `true`; same `transferCode` is returned |
| TP-084 | Attempt to initiate a top-up with an amount below the minimum threshold | Wallet | Medium | `BadRequestException` is thrown |
| TP-085 | Check the status of a PENDING top-up transaction that has not expired | Wallet | High | Status `PENDING` is returned |
| TP-086 | Check the status of a PENDING top-up that has passed its expiration time | Wallet | High | Top-up is auto-expired; status `EXPIRED` is returned |
| TP-087 | Retrieve a paginated list of wallet transactions for a given wallet | Wallet | Medium | Paginated result is returned; `total` count is correct |
| TP-088 | Ensure a user wallet is created (upserted) when it does not yet exist | UserWallet | High | Wallet record is created; `userId` matches the input |
| TP-089 | Retrieve a paginated list of transactions for a user wallet | UserWallet | High | Paginated result is returned; `total` and `items` counts are correct |
| TP-090 | Initiate a new user top-up transaction for the first time | UserWallet | High | New topup record is created; `transferCode` is returned; `isReuse` is `false` |
| TP-091 | Attempt to initiate a user top-up with a zero amount | UserWallet | High | `BadRequestException` is thrown |
| TP-092 | Check the status of a COMPLETED user top-up transaction | UserWallet | High | Status `COMPLETED` is returned |
| TP-093 | Attempt to check the status of a user top-up that does not exist | UserWallet | High | `NotFoundException` is thrown |
| TP-094 | Retrieve the currently active pending top-up for a user | UserWallet | Medium | Pending top-up object with the correct `transferCode` is returned |
| TP-095 | Retrieve active pending top-up when no pending top-up exists for the user | UserWallet | Medium | Returns `null` |
| TP-096 | Initiate a user wallet withdrawal with sufficient available balance | UserWallet | High | Withdrawal transaction is created with `PENDING` status |
| TP-097 | Attempt to initiate a user withdrawal when balance is insufficient | UserWallet | High | `BadRequestException` is thrown |
| TP-098 | Process a SePay user top-up webhook with a duplicate `sepayId` (idempotency) | UserWallet | High | Returns a response with message `'Already processed'` |
| TP-099 | Process a SePay user webhook with an invalid API key | UserWallet | High | `UnauthorizedException` is thrown |
| TP-100 | Verify a phone number using a valid Firebase ID token and create a guest session | GuestAuth | High | Guest session is created; access token is returned; phone number is normalised |
| TP-101 | Verify phone with an invalid or expired Firebase ID token | GuestAuth | High | `UnauthorizedException` is thrown |
| TP-102 | Refresh guest token for a valid, non-expired session | GuestAuth | High | New access token is returned |
| TP-103 | Attempt to refresh token for a guest session that has expired | GuestAuth | High | `UnauthorizedException` is thrown |
| TP-104 | Attempt to refresh token for a guest session ID that does not exist | GuestAuth | High | `UnauthorizedException` is thrown |
| TP-105 | Logout a guest user and expire their session | GuestAuth | Medium | Session is updated; success response is defined |
| TP-106 | Attempt to convert a guest session that has already been converted to a user | GuestAuth | Medium | `BadRequestException` is thrown |
| TP-107 | Attempt to convert a guest session ID that does not exist | GuestAuth | Medium | `BadRequestException` is thrown |
| TP-108 | Open a dispute as a CUSTOMER for a valid payment they own | Dispute | High | Dispute case is created; `disputeId` is returned in the response |
| TP-109 | Attempt to open a dispute for a payment ID that does not exist | Dispute | High | `NotFoundException` is thrown |
| TP-110 | Attempt to open a dispute where the `orderId` does not match the payment request | Dispute | High | `BadRequestException` is thrown |
| TP-111 | Attempt to open a dispute for a payment owned by a different customer | Dispute | High | `ForbiddenException` is thrown |
| TP-112 | Attempt to open a dispute for a payment that already has an active dispute | Dispute | High | `BadRequestException` is thrown |
| TP-113 | Retrieve all disputes for a CUSTOMER with unread message count | Dispute | High | Paginated result is returned; `unreadCount` is computed correctly |
| TP-114 | Retrieve all disputes for a PROVIDER | Dispute | High | Paginated result with `total` count is returned |
| TP-115 | Retrieve detailed information of a dispute for the owning CUSTOMER | Dispute | High | Dispute detail with `permissions` object is returned |
| TP-116 | Attempt to retrieve a dispute detail for a dispute ID that does not exist | Dispute | High | `NotFoundException` is thrown |
| TP-117 | Attempt to view dispute detail by a user who is not a party to the dispute | Dispute | High | `ForbiddenException` is thrown |
| TP-118 | PROVIDER sends a message in a dispute where it is their turn to reply | Dispute | High | Message is created; dispute status is updated |
| TP-119 | Attempt to send a message in a dispute that does not exist | Dispute | High | `NotFoundException` is thrown |
| TP-120 | CUSTOMER attempts to send a message when their reply is not permitted | Dispute | High | `BadRequestException` is thrown |
| TP-121 | List all withdrawal accounts for a given provider | WithdrawalAccounts | Medium | Array of account objects is returned |
| TP-122 | Create a withdrawal account for a valid PROVIDER user | WithdrawalAccounts | High | Account is created; `accountNumber` matches the provided input |
| TP-123 | Attempt to create a withdrawal account for a user ID that does not exist | WithdrawalAccounts | High | `NotFoundException` is thrown |
| TP-124 | Attempt to create a provider withdrawal account for a USER (wrong role) | WithdrawalAccounts | High | `ForbiddenException` is thrown |
| TP-125 | Update an existing provider withdrawal account with new bank details | WithdrawalAccounts | Medium | Updated account object with new `bankName` is returned |
| TP-126 | Attempt to update a provider withdrawal account that does not exist | WithdrawalAccounts | Medium | `NotFoundException` is thrown |
| TP-127 | Delete an existing provider withdrawal account | WithdrawalAccounts | Medium | Returns `success: true` |
| TP-128 | Attempt to delete a provider withdrawal account that does not exist | WithdrawalAccounts | Medium | `NotFoundException` is thrown |
| TP-129 | List all withdrawal accounts for a given customer (user) | WithdrawalAccounts | Medium | Array of account objects is returned |
| TP-130 | Create a withdrawal account for a valid USER | WithdrawalAccounts | High | Account is created; `accountHolderName` matches the provided input |
| TP-131 | Attempt to create a customer withdrawal account for a user ID that does not exist | WithdrawalAccounts | High | `NotFoundException` is thrown |
| TP-132 | Update an existing customer withdrawal account | WithdrawalAccounts | Medium | Updated account object is returned |
| TP-133 | Attempt to update a customer withdrawal account that does not exist | WithdrawalAccounts | Medium | `NotFoundException` is thrown |
| TP-134 | Delete an existing customer withdrawal account | WithdrawalAccounts | Medium | Returns `success: true` |
| TP-135 | Attempt to delete a customer withdrawal account that does not exist | WithdrawalAccounts | Medium | `NotFoundException` is thrown |
| TP-136 | `computeOrderedMissingFields` lists mandatory fields first when no data is provided | Chatbot | Medium | Missing fields are returned in order: `incidentType`, `vehicleType`, `contactPhone`, `pickupLocation` |
| TP-137 | `computeOrderedMissingFields` appends optional fields only once all mandatory ones are filled | Chatbot | Medium | Optional fields `licensePlate` and `vehicleColor` are returned |
| TP-138 | `computeOrderedMissingFields` returns empty array when all required fields are present | Chatbot | Medium | Empty array `[]` is returned |
| TP-139 | `buildCustomerKnownSnapshot` omits fields with falsy or empty values | Chatbot | Low | Only non-empty fields are present in the returned object |
| TP-140 | `formatMissingFieldsDirective` generates a directive string with correct markers | Chatbot | Low | Output string contains `[MISSING_FOR_ORDER]`, missing field names, `[CUSTOMER_KNOWN]`, and the `cấm hỏi lại` instruction |
| TP-141 | Create a chatbot conversation for a logged-in USER | Chatbot | High | Conversation is created with `userId` and `userRole` set correctly |
| TP-142 | Create a chatbot conversation for an unauthenticated GUEST user | Chatbot | High | Conversation is created with `guestSessionId` set |
| TP-143 | List all conversations for an authenticated USER | Chatbot | High | Array of conversations belonging to the user is returned |
| TP-144 | List all conversations for an authenticated GUEST using `guestSessionId` | Chatbot | High | Query is filtered by `guestSessionId` |
| TP-145 | Retrieve a specific conversation including its messages for the owner | Chatbot | High | Conversation object with `messages` array is returned |
| TP-146 | Attempt to retrieve a conversation that does not exist | Chatbot | High | `NotFoundException` is thrown |
| TP-147 | Attempt to retrieve a conversation belonging to a different user | Chatbot | High | `ForbiddenException` is thrown |
| TP-148 | Delete a conversation belonging to the requesting user | Chatbot | High | `success: true` is returned; deletion is persisted |
| TP-149 | Attempt to delete a conversation that does not exist | Chatbot | High | `NotFoundException` is thrown |
| TP-150 | Attempt to delete a conversation belonging to a different user | Chatbot | High | `ForbiddenException` is thrown |
| TP-151 | Admin retrieves the full list of providers | Admin | High | Non-empty array of provider objects is returned |
| TP-152 | Admin filters provider list by verification status (e.g., `PENDING`) | Admin | High | Query is constructed with the correct `verificationStatus` filter |
| TP-153 | Admin retrieves detailed information for a specific provider | Admin | High | Provider detail object with correct ID and stats is returned |
| TP-154 | Admin attempts to get detail for a provider that does not exist | Admin | High | `NotFoundException` is thrown |
| TP-155 | Admin approves a provider with `PENDING` verification status | Admin | High | Provider `verificationStatus` is updated to `APPROVED` |
| TP-156 | Admin attempts to approve a provider that does not exist | Admin | High | `NotFoundException` is thrown |
| TP-157 | Admin rejects a PENDING provider with a rejection reason | Admin | High | Provider `verificationStatus` is updated to `REJECTED` |
| TP-158 | Admin suspends an approved provider | Admin | High | `bannedAt` timestamp is set on the provider record |
| TP-159 | Admin retrieves a paginated list of all users | Admin | High | Paginated result with `items` and `total` is returned |
| TP-160 | Admin suspends a user account | Admin | High | `bannedAt` timestamp is set; active sessions are cleared |
| TP-161 | Admin attempts to suspend a user that does not exist | Admin | High | `NotFoundException` is thrown |
| TP-162 | Admin re-activates a suspended user account | Admin | High | `bannedAt` is set to `null` |
| TP-163 | Admin retrieves the billing and commission configuration | Admin | Medium | Configuration object with `COMMISSION_RATE` and bank account details is returned |
| TP-164 | Admin retrieves the overall financial transaction summary | Admin | Medium | Summary object with defined `totalRevenue` is returned |
| TP-165 | Admin retrieves rescue request statistics | Admin | Medium | Statistics object with request counts is returned |
| TP-166 | Admin retrieves dispute statistics | Admin | Medium | Statistics object with dispute counts is returned |
| TP-167 | Admin retrieves user statistics | Admin | Medium | Statistics object with `total` user count is returned |
| TP-168 | Generate an R2 presigned upload URL for a valid `request_photo` purpose | Uploads | High | Response contains a URL pointing to the presigned endpoint and a valid `uploadId` |
| TP-169 | Attempt to generate a `provider_verification` presigned URL without a `docType` | Uploads | High | `BadRequestException` is thrown |
| TP-170 | Attempt to generate a presigned URL for a file that exceeds the size limit | Uploads | High | `BadRequestException` is thrown |
| TP-171 | Attempt to generate a presigned URL for an unsupported content type (e.g., PDF) | Uploads | High | `BadRequestException` is thrown |
| TP-172 | Confirm an upload record after the file has been transferred to storage | Uploads | High | `success: true` is returned; upload record is marked as `confirmed` |
| TP-173 | Attempt to confirm an upload that does not exist | Uploads | High | `NotFoundException` is thrown |
| TP-174 | Attempt to confirm an upload owned by a different user | Uploads | High | `ForbiddenException` is thrown |
| TP-175 | Delete an existing R2 upload record | Uploads | High | `success: true` is returned; record is removed |
| TP-176 | Attempt to delete an upload record that does not exist | Uploads | High | `NotFoundException` is thrown |
| TP-177 | Retrieve all uploads belonging to a specific user | Uploads | Medium | Array of upload objects is returned with the correct IDs |
| TP-178 | Retrieve uploads for a user filtered by a specific purpose | Uploads | Medium | Database query includes the correct `purpose` filter |
| TP-179 | Track a Cloudinary video upload and create a confirmed database record | Uploads | High | Response contains the `uploadId` of the newly created record |
| TP-180 | Delete a Cloudinary upload record by its upload ID | Uploads | High | `success: true` is returned; Cloudinary asset is also removed |
| TP-181 | Attempt to delete a Cloudinary upload record that does not exist | Uploads | High | `NotFoundException` is thrown |
