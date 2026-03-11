# Brainstorm

This entire legal system could fit easily into context for a LLM. Entire query logic could probably be single LLM call with the laws injected to prompt. However, this is not a real-world use case, Westeros Capital Group would have many more laws throughout the kingdom in reality, so RAG is best.

Users should be able to upload new laws to the system.

This is for Westeros Capital Group, so should be framed for a financial lens. Users could be compliance officers, advisors to lords, lending officers, or investors.

Styling - should include Norm AI and Westeros Capital Group branding, but consistent with rest of Norm AI product suite styling / components.

V2 (not MVP) - Laws change, may apply to all of westeros, certain regions (North), or city/town level. They also may apply to different classes (e.g., royal family, peasant), but let's assume not for ethical reasons.

This was what was passed in originally to start coming up with PRD:

# MVP

Most important is that what built works, is well tested, matches the codebase style, and is well-organized and quality code, in order to shift and grow the requirements over time.

## Backend

### Legal Documents
-  system admins needs to be able to load any number of documents into Qdrant + SQL database (sqlite) + blob storage (filesystem)
- document type? 
  - Legal document to add to legislation

### Query
- Expand on RAG, citations


## UI

- Westeros & Norm AI branded NavBar
- User Profile with stubbed login / logout
- reponses include citations with laws
    - extra credit - click to preview the legal document with relevant language highlighted

## Monitoring

* TBD


# Out of Scope

* Authentication (simple auth for MVP, but look professional as this is presented to important members of Westeros Capital Group). Roadmap would have role-based SAML authentication linking to IDP.
* CI/CD
* Cloud deployment? 
* System Admin UI?

Upload non-law documents for review - although should experiment if given time

- versioning laws -> many fickle rulers in the kingdom may change laws frequently
  - document table has is_current, version number, and effective/sunset dates - fetch current docs only, feed to document IDs to RAG
- jurisdiction levels, vastly different laws for different regions of the kingdom
