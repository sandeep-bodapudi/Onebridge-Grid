# N08: Real-time chat and message requests
Priority: Must     Build phase: N-1     Depends on: N01, N02, F22, N09, N10
Source: D-CONTACT (no public phone numbers), plan section 3a

## User story
As a member or visitor, I message a company or a person in real time instead of calling a number I cannot see. As a company, my team answers from a shared inbox, and conversations stay with the company when someone leaves.

## Acceptance criteria
- **Conversation types:**
  - member to member
  - member to company
  - company to company
  - visitor (signed in) to an employee through their company card
- **Real time.** Messages are delivered over WebSocket within 1 second when both sides are online, with:
  - typing indicator
  - delivered and read receipts (members can turn read receipts off, N10)
  - online status (members can hide it, N10)
- **Message content:**
  - text up to 4,000 characters
  - images and PDFs up to 25 MB each, 10 per message
  - emoji
  - link previews
  - reply to a message
- **Edit and unsend.** A sender can edit within 15 minutes ("Edited" shown) and unsend within 15 minutes ("Message removed" shown to both).
- **Message requests** (spam control):
  - A first message to someone you have no conversation with, and no follow from them, arrives as a request.
  - The receiver can accept, ignore (silent) or block and report (N09).
  - The sender can send one message, with no links or attachments, until the receiver accepts.
  - No request step for: verified companies messaging members who follow them, confirmed business relationships (N06), and replies to a requirement (N07) or call request (N11).
  - New messages from strangers per day are capped by plan (plan section 5) and lower for new accounts (N09).
- **Company inbox:**
  - Conversations to a company go to its inbox, routed like enquiries (F26: branch contact, then default contact).
  - Owner and Admins see all conversations.
  - Other seats see conversations assigned to them.
  - Conversations can be assigned and reassigned, marked open or done, and have internal notes (never shown to the other side).
  - Conversation ownership: a conversation with a company or with an employee through their company card **belongs to the company** (as leads do). When the employee is offboarded (F16), it stays in the inbox and is reassigned.
  - Personal member-to-member conversations belong to the members.
- **Notifications** (F22) when the receiver is offline: push, email or WhatsApp per their preferences, **without message content**. For example: "New message from Sahyadri Steel Works".
- **Leads.** The first message from a person to a company creates a lead with source `chat` (Phase 1 Lead).
- **Security:**
  - Messages encrypted at rest (company conversations with the tenant key, ADR-0002 style; personal ones with a per-conversation key).
  - Attachments scanned for malware before delivery.
  - No message content in logs or analytics events.
- **Search** within your own conversations by participant and text.
- **Block** (N09) stops messages both ways and hides the conversation for the blocker.
- **Offline:** messages typed while offline are queued and sent on reconnect, with a clear "Not sent yet" state.

## States to design
Empty inbox, conversation list, unread, message request (received, sent and waiting), request limit reached, typing, sending, sent, delivered, read, failed (retry), edited, unsent, attachment uploading or too large, blocked, conversation with a suspended account, assigned to me, assigned to someone else, done, offline.

## API and events
- `GET /conversations?folder=inbox|requests|done&cursor=`
- `POST /conversations` (start, with first message)
- `GET /conversations/{id}/messages?cursor=`
- `POST /conversations/{id}/messages`
- `PATCH /messages/{id}` (edit)
- `DELETE /messages/{id}` (unsend)
- `POST /conversations/{id}:accept`
- `POST /conversations/{id}:ignore`
- `POST /conversations/{id}/assign`
- `POST /conversations/{id}/notes`
- `POST /conversations/{id}/read`

WebSocket channel `/realtime` events: `message.new`, `message.updated`, `typing`, `read`, `presence`.

Domain events: `conversation.started`, `message.sent` (IDs only), `conversation.assigned`.

## Data
- `Conversation` (id, type, participants, ownerType `company` | `members`, tenantId?, status, assignedSeatId?, requestState, lastMessageAt)
- `Message` (id, conversationId, senderType, senderId, encryptedBody, attachments, editedAt, unsentAt, createdAt)
- `InternalNote`

Lives in a `messaging` service: MongoDB for storage, Redis pub/sub for fan-out across WebSocket servers.

## Tests required
- Delivery under 1 second on the in-memory adapter.
- Request rules and exemptions.
- One message before acceptance.
- Edit and unsend windows.
- Company ownership and reassignment on offboarding.
- Admins see all, seats see assigned.
- Notifications carry no content.
- Encryption at rest.
- Block both ways.
- Offline queue.
- Cross-tenant: one company cannot read another's inbox.
- Load: 1,000 concurrent sockets on one node.

## Open questions
- Edit and unsend window (proposed 15 minutes).
- Message retention for company conversations (proposed: kept while the company account exists; deleted with the company per F28).
- Voice notes: in N-1 or later?

## Out of scope
Group chats with more than 2 parties (except the company inbox team), voice and video calls in chat (see N11 for call requests), end-to-end encryption (at-rest encryption only), chatbots (AGENTS.md section 10: no AI features).
