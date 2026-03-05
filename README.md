# US Visa Analytics Dashboard

Public dashboard surfacing US work visa program statistics — H-1B, L-1A/L-1B, and OPT/CPT — sourced directly from official US government data and auto-refreshed weekly.

## Data Sources

| Program | Source | Years Available |
|---------|--------|----------------|
| H-1B employer data | [USCIS H-1B Employer Data Hub](https://www.uscis.gov/tools/reports-and-studies/h-1b-employer-data-hub) | FY2009–present |
| H-1B LCA filings | [DOL LCA Disclosure Data](https://www.dol.gov/agencies/eta/foreign-labor/performance) | FY2019–present |
| L-1A / L-1B | [USCIS I-129 Form Data](https://www.uscis.gov/tools/reports-and-studies/immigration-forms-data) | FY2010–present |
| OPT / CPT / STEM OPT | [ICE SEVIS By the Numbers](https://www.ice.gov/sevis/sevis-by-the-numbers) | FY2018–present |

## Stack

- **Frontend**: React 18 + Recharts + Webpack (deployed on Netlify)
- **Backend**: Node.js + Express 5 (deployed on Render.com)
- **Database**: MongoDB Atlas (free tier)
- **Scheduler**: node-cron (weekly refresh, every Sunday 2am UTC)

## Local Development

### Prerequisites
- Node.js 20+
- MongoDB Atlas connection string (or local MongoDB)

### Setup

```bash
# Clone repo
git clone https://github.com/ankkhand/data-analytics-reporting-visa-status-details
cd data-analytics-reporting-visa-status-details

# Install root + client dependencies
npm install
cd client && npm install && cd ..

# Configure environment
cp .env.example .env
# Edit .env and add your MONGODB_URI

# Run historical seed (one-time, ~15–30 min depending on network)
node scripts/seed-historical.js

# Start development servers
npm run dev          # starts Express API on :4001
cd client && npm start  # starts Webpack dev server on :3000
```

### Seed specific sources only
```bash
node scripts/seed-historical.js --only h1b
node scripts/seed-historical.js --only l1,sevis
node scripts/seed-historical.js --only lca
```

## API Reference

```
GET /api/health
GET /api/h1b/stats?year=&country=&state=
GET /api/h1b/trends?country=
GET /api/h1b/sponsors?year=&limit=20
GET /api/h1b/countries?year=&limit=50
GET /api/h1b/states?year=
GET /api/l1/stats?year=&type=L1A|L1B
GET /api/l1/trends?type=
GET /api/l1/countries?year=&type=
GET /api/optcpt/stats?year=&country=
GET /api/optcpt/trends
GET /api/optcpt/schools?year=&limit=20
GET /api/optcpt/countries?year=&limit=50
GET /api/faq?visa=h1b|l1|opt
GET /api/sync/status
```

## Deployment

### Backend (Render.com)
1. Connect this GitHub repo to Render
2. Set `MONGODB_URI` environment variable
3. `render.yaml` handles the rest

### Frontend (Netlify)
1. Connect this GitHub repo to Netlify
2. Update the `/api/*` redirect in `netlify.toml` to point to your Render URL
3. Netlify auto-deploys on push to `main`

## License

MIT — data is sourced from public US government databases and is in the public domain.
