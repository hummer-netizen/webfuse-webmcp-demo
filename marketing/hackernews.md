# Hacker News Submission

## Title (80 char limit):
WebMCP asks websites to cooperate. Webfuse doesn't have to ask

## URL:
https://dev.to/webfuse/webmcp-asks-websites-to-cooperate-webfuse-doesnt-have-to-ask
(or webfuse.com/blog/webmcp-webfuse if published there first)

## If posting as "Show HN":
Show HN: AI agent tools on any website without site owner cooperation (Webfuse)

## Backup titles (if first doesn't land):
- Chrome 146 ships WebMCP today. Here are its three fatal assumptions
- The party that wants AI web automation isn't the site owner
- Why WebMCP won't matter for years, and what to build on instead

## Timing:
Post between 14:00-16:00 UTC (9-11am US East) for maximum visibility.
Monday is good — weekday HN traffic, Chrome 146 is hot news.

## If asked to comment / first comment:
Hey HN — I'm building Webfuse (webfuse.com). We're a proxy layer that lets
AI agents interact with any website through the user's live browser session.

Chrome 146's WebMCP is genuinely cool — structured tools for AI agents is the
right direction. But after building integrations for a dozen enterprise customers,
we kept hitting the same three walls:

1. The sites our customers need to automate have zero incentive to implement WebMCP
2. Real workflows cross 3-5 different sites — WebMCP is per-page
3. Our customers (AI builders, agencies, consultancies) want to define the tools,
   not wait for site owners to do it

So we built a proxy approach: the user browses normally (their real session),
and Webfuse lets you inject custom semantic tools on any page.

Live demo on Booking.com: https://webfu.se/+bookingcom-agent-demo
Source: https://github.com/hummer-netizen/webfuse-webmcp-demo

Would love to hear from anyone building AI agents that interact with the web —
what's your current approach and what breaks?
