# Agent notice relay

This tiny worker sends the bare Best Legal Net agent notice after a case intake
succeeds. It is not deployed, and the public site will not call it, until Salim
approves a switch-on step.

## What the agent is sent

Subject:

    New submission through your Best Legal Net link

Body (the date is the calendar date in America/Denver):

    A submission came through your link on [date]. Do not contact the person. You will not receive their information.

Nothing else. No name, phone, email, case type, injury, location, insurance,
fees, pay, or links. The public site posts only `{ "agent": "1" }`. Any other
fields are rejected.

## Why a relay

The site is static GitHub Pages, so agent inboxes cannot stay only on a server
unless a small relay is added.

FormSubmit can send mail, but a first-time address (or a random-string alias)
only works after that inbox clicks an activation link. That would email the
agent just to turn the feature on, so it is not used now. The public config also
refuses any destination that looks like an email address, so an agent inbox
cannot leak into page source by mistake.

The relay keeps every agent address in a Worker secret. The public JavaScript
never contains those addresses.

## Switch-on (needs Salim's yes)

Do not do any of this until Salim approves the specific steps:

1. Create a Cloudflare Worker (or equivalent) from `agent-notice-worker.js`.
2. Create a sending account for the mail API used by the worker (the sample
   uses Resend). Set `MAIL_FROM` to an address on a domain the sender can use.
3. Store agent inboxes only as secrets (`AGENT_EMAIL_1` for agent 1, and later
   `AGENT_EMAIL_2` if that agent should also get notices). Do not commit them.
4. Set `ALLOWED_ORIGINS` to the live site origins.
5. Put the worker HTTPS URL in `js/agent-notice-config.js` as `relayUrl` and
   set `enabled` to `true` in a later preview for Salim to approve.

Until that happens, `js/agent-notice-config.js` stays `enabled: false`,
`relayUrl` stays empty, and no notice is sent. The intake still goes only to
the office inbox already configured on the forms.

An alternative, only if Salim would rather not add a worker, is a FormSubmit
random-string alias. That path still requires a one-time activation email to
the agent's inbox, so it should not be used unless he explicitly says yes to
that email.

## Deployed worker

Public URL: https://bln-agent-notice.salimheyaime.workers.dev

The account workers.dev subdomain is `salimheyaime`. That is a Cloudflare
workers.dev hostname, not a Namecheap or custom-domain DNS change. Do not
attach a custom domain (that would need DNS changes).

Sender (already verified, no DNS changes):

    Best Legal Net <no-reply@coachsalimheyaime.com>

CORS is locked in the worker to `https://bestlegalnet.com`,
`https://www.bestlegalnet.com`, and `https://blc.salimheyaime.com`.

Test without sending mail: `POST /dry-run` with `{ "agent": "1" }`. The
response includes the exact subject and body and a `wouldSend` flag. It never
includes the destination address and never sends mail.

The live site still will not call this worker until `enabled` is set to `true`
in `js/agent-notice-config.js`.
