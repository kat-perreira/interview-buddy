// Dev only: twelve canned candidate answers for the notification-service scenario, used by
// `npm run dev:session` and the Fill Next Answer button (dev builds only). They follow the
// scenario's pacing: scoping in turns 1-3, core design in 4-8, deep dives and wrap-up after.
//
// Aimed at a medium score (mostly Solid, some Developing): scoping and the high-level flow are
// clear, storage choices come without much reasoning, scaling leans on "add workers", and
// tradeoffs are named but not weighed. They can't react to Bubo's actual follow-ups, so use
// them for cost, speed, and UI checks, not for the tone review.

export const CANDIDATE_SCRIPT: readonly string[] = [
  // 1. Clarifying questions
  `Okay, before I draw anything I'd like to ask a few questions. Who is sending these notifications: is this an internal service for our own product teams, or something like a platform other companies send through? And roughly what scale are we talking about, like sends per day? Also, do users get to pick which channels they want?`,

  // 2. Requirements
  `Got it, so multi-tenant, around 10 million sends a day with spikes. Let me list what I think the requirements are. Functional: a tenant can send a notification to one user or a list of users, on push, email, or SMS. Users have preferences, so they can opt out of a channel. We should be able to see if something was delivered. Non-functional: it should be reliable, so we don't lose notifications, and it should handle the spikes. Latency matters more for push than email, I think. I'll leave templates and an in-app inbox out for now.`,

  // 3. Scale estimate
  `Quick math: 10 million a day is roughly 115 per second on average. If spikes are 10x, that's about 1,200 per second at peak, and fan-out could make one event turn into a lot of sends, so maybe plan for a few thousand per second. That's not huge, but it means we probably want a queue so we're not calling providers directly from the API.`,

  // 4. High-level components
  `Here's the high-level picture. A tenant calls our Notification API. The API validates the request, checks the tenant's auth, and writes a message onto a queue. Then there are workers that read from the queue, look up the user's preferences, figure out which channels to use, and pass it to channel-specific senders: one for push, one for email, one for SMS. Those senders call the outside providers, like APNs and FCM for push, an email provider, and an SMS provider.`,

  // 5. End-to-end flow
  `Walking one notification through: the tenant sends "order shipped" for user 42. The API returns 202 right away with a notification ID. A worker picks it up, sees user 42 wants push and email but not SMS, and creates two delivery tasks. Each one goes on its own channel queue. The push sender calls FCM, gets a success, and marks that delivery as sent. If email fails, it gets retried. I think separate queues per channel help, because a slow email provider shouldn't hold up push.`,

  // 6. Data model (light on reasoning)
  `For data, I'd have a few tables. Notifications: ID, tenant ID, user ID, type, payload, created time. Deliveries: delivery ID, notification ID, channel, status, attempts, last error. Preferences: user ID, tenant ID, channel, opted in or not. Device tokens for push. I'd probably just use Postgres for all of it to start. We could move to something else later if it gets too big.`,

  // 7. APIs
  `The main API would be POST /notifications with the user ID or list of users, the type, the channels if they want to force one, and the content. It returns the notification ID. Then GET /notifications/{id} to check status, which returns the status of each delivery. And a preferences API, something like PUT /users/{id}/preferences, so the tenant's app can update what the user opted into.`,

  // 8. Retries and idempotency
  `For reliability, the workers retry failed sends with backoff, maybe three to five tries, then mark it failed. I'd want an idempotency key on the POST so if a tenant retries their request we don't send twice. Inside our system, I'm not totally sure how to make sure a worker crash doesn't cause a duplicate send. Maybe we check the delivery status before sending? That has a race, but it might be good enough for notifications.`,

  // 9. Scaling (leans on "add workers")
  `For the spikes, the queue absorbs the burst, and we can scale workers horizontally, so add more workers when the queue gets deep. The API is stateless so that scales out too. The database might become the bottleneck with all the delivery status writes. We could add read replicas for the status lookups. I haven't thought much about partitioning yet.`,

  // 10. Failure handling
  `If a provider is down, like the SMS provider has an outage, the retries would keep failing. We could have a second SMS provider and switch over. For bad device tokens, when FCM tells us the token is invalid, we should delete it so we stop trying. And for rate limiting, I'd add a per-tenant limit at the API so one tenant's launch doesn't starve everyone else. Probably also a limit per user so we don't spam someone.`,

  // 11. Tradeoffs (named, not weighed)
  `On tradeoffs: I picked a queue over calling providers directly, which adds some latency but makes it much more reliable. Postgres is simpler than a NoSQL store, though it might not scale as well for the delivery table. And I went with at-least-once delivery, so a user might occasionally get a duplicate, which I think is better than missing one.`,

  // 12. Wrap-up
  `To sum up: tenants call a stateless API, we queue everything, workers apply preferences and fan out to per-channel queues, and channel senders talk to the providers with retries. Status is tracked per delivery. If I had more time I'd go deeper on monitoring, like delivery rate and queue depth per channel, quiet hours, and how to partition the delivery data. Thanks, this was fun to think through.`,
];
