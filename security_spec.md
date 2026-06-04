# Security Specification

## 1. Data Invariants
- A chat session cannot exist without a valid User ID that matches the requesting user.
- A message cannot exist without an overarching chat session belonging to the user.
- Timestamps (`createdAt`, `updatedAt`) must mirror the server clock upon creation/update.
- Read/Write access is strictly owner-only.

## 2. The "Dirty Dozen" Payloads
1. **Spoofed User ID Creation**: A payload where `userId` does not match `request.auth.uid`.
2. **Missing Author/Session**: Attempt to create a message without setting valid relational mappings.
3. **Invalid Role Type**: Message role is `admin` instead of `user` or `model`.
4. **Oversized String Injection**: Injecting a 2MB string into `text` or `notes` to exhaust storage/reads (Denial of Wallet).
5. **Ghost Field Injection**: Passing `isAdmin: true` inside a Session creation block.
6. **Time-Traveling Writes**: Forging `createdAt` or `updatedAt` to be hours in the past instead of `request.time`.
7. **Array/Notes Size overflow**: Setting `messages` as a mega array directly on the session object instead of subcollections (not allowed per schema).
8. **Privilege Escalation Update**: Attempting to alter `userId` of an existing ChatSession to steal it.
9. **Bypassing Updates State**: Updating `title` with a boolean or number instead of a string.
10. **Query Scrape Attempt**: Trying to list `/users/{otherId}/sessions` when `request.auth.uid != otherId`.
11. **Type Poisoning**: `rpConfig.scenario` passed as an Array instead of a String.
12. **Unauthenticated Access**: Attempting to read or write without a valid auth token.

## 3. The Test Runner
A test suite (if executed) would systematically fire these 12 operations and ensure they return `PERMISSION_DENIED` due to schema mismatches, ID validation failures, relational discrepancies, or schema gaps.
