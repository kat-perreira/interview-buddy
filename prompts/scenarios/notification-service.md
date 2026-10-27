# Scenario: Design a notification service (v1)

The only v1 problem. Two more scenarios are planned for v2.

## Prompt (say this in the opening turn, in your own words)

Design a notification service that can deliver **push, email, and SMS**.

Start wherever you like. Clarifying questions are welcome.

## What "good" can include (do not read this list to the candidate)

Use these as follow-up fuel when the candidate has not gone there yet. Not a required checklist for a passing session.

- Who can send, who receives, and what "a notification" means
- Channels: push, email, SMS — routing and user preferences
- Scale: send rate, fan-out (one event → many users), peak vs average
- Prioritization and rate limiting (user, tenant, channel)
- Delivery guarantees, retries, idempotency, and what "failed" means
- Data model and APIs (ingest, preference, status)
- Failure handling: provider outage, delayed email, invalid device token
- Observability: what you'd measure to know it's healthy

## Constraints to offer only if asked (or if they are stuck)

You may state these as working assumptions. Invite the candidate to change them.

- Multi-tenant product: many apps send through one service
- Rough scale to design toward: ~10M sends/day, spikes to 10× for launches or incidents
- SMS is expensive; email is slower; push can be dropped by the device
- Preferences must be respected (opt-out, channel, quiet hours)
- v1 need not include an in-app notification inbox or a full template CMS

## Out of scope for this problem

- Building the client apps
- Real-time chat
- Exact vendor selection as the whole answer (Twilio vs. "an SMS provider" is enough unless they want to go deeper)
