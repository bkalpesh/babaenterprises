# BABA ENTERPRISES — Industrial Rubber & Plastic Components

A full-stack, production-grade web application and enterprise portal for **BABA ENTERPRISES**, an industrial rubber and plastic components supplier based in Pune, Maharashtra, India.

---

## Overview

BABA ENTERPRISES supplies precision rubber moulded components, sealing solutions, vibration dampeners, and engineering plastic parts to automotive, electrical, engineering, defense, and heavy equipment manufacturers.

This web application serves as the primary digital presence and procurement portal for BABA ENTERPRISES, providing prospective buyers with interactive product specifications, dynamic Request for Quotation (RFQ) workflows with technical drawing uploads, bilingual support (English and Marathi), and a secure administrative dashboard.

---

## Key Features

### 1. Bilingual Support (English & मराठी)
- Global language toggle (**EN | मराठी**) accessible from the navigation bar on both desktop and mobile viewports.
- Complete Marathi translations covering navigation, hero messaging, product specifications, company history, customer references, quality assurance, and enquiry forms.
- Language preference persistence via browser storage.

### 2. Product Catalogue & Detailed Specifications
- Comprehensive industrial product listings across categories:
  - **Rubber Components**: Rubber Washers, Rubber Bushes & Bushings, Rubber Grommets, Rubber Buffers & Mounts, Custom Rubber Moulded Parts.
  - **Sealing & Fluid Handling**: Rubber O-Rings, Rubber Gaskets, Rubber Bellows & Dust Boots, Extruded Rubber Profiles & Cords.
  - **Engineering Plastics**: Industrial Plastic Components, Machined Engineering Plastics, Precision Plastic Bushings & Spacers.
- Filterable by material: Nitrile (NBR), EPDM, Neoprene (CR), Silicone, Polyurethane (PU), Natural Rubber (NR), Nylon (PA6/PA66), PTFE (Teflon), Polyoxymethylene (Delrin/POM), and Polypropylene (PP).
- Deep linking support using URL hash routing (`#products/:slug`).
- Interactive product detail modal with application guidelines, material properties, and related components.

### 3. Request for Quotation (RFQ) & Technical Enquiries
- Dual enquiry workflows: in-page comprehensive technical enquiry section and quick quotation modal.
- Prefilled category linking when requesting a quote directly from a specific product.
- File attachment support for engineering drawings and CAD files (`.pdf`, `.dwg`, `.dxf`, `.step`, images).
- Automatic reference tracking code generation (`BE-RFQ-YYYYMMDD-XXXX`).

### 4. Institutional & Engineering Reference Profiles
- Demonstrates component profiles aligned with industrial, public sector, and defense engineering specifications:
  - Bharat Heavy Electricals Limited (BHEL)
  - Bharat Electronics Limited (BEL)
  - Armament Research and Development Establishment (ARDE - DRDO)
  - Defence Research and Development Organisation (DRDO)
  - Ammunition Factory Khadki (AFK)
  *(Note: Reference profiles illustrate component manufacturing capabilities and engineering specifications. All institutional names and trademarks remain the property of their respective entities.)*

### 5. Secure Administration Portal
- Accessible via the `#admin` route with modal interface.
- **Server-Side Authentication**: Passcode validation performed securely on the server via constant-time comparison (`crypto.timingSafeEqual`) to mitigate timing attacks.
- **Brute-Force Protection**: Server-side IP rate limiting restricting failed attempts (5 attempts, followed by a 15-minute lockout).
- **Enquiry Management**: Review, filter by status (`New`, `Contacted`, `Quotation Sent`, `In Discussion`, `Closed`), search, add internal notes, and export enquiry records.
- **Catalogue & Profile Controls**: Manage active products, customer reference cards, and official business contact information.

### 6. Search Engine Optimization & Structured Data
- Schema.org `LocalBusiness` JSON-LD structured data embedding geo-coordinates, GSTIN, telephone contacts, and operating hours.
- Open Graph and Twitter Card metadata for industrial trade sharing.

---

## Technologies & Frameworks

- **Frontend Core**: [React 19](https://react.dev/), [TypeScript](https://www.typescriptlang.org/)
- **Styling & UI**: [Tailwind CSS v4](https://tailwindcss.com/) with `@tailwindcss/vite`
- **Iconography**: [Lucide React](https://lucide.dev/)
- **Animation**: [Motion](https://motion.dev/)
- **Build System**: [Vite 8](https://vitejs.dev/) with `@vitejs/plugin-react`
- **Backend Server**: [Express 4](https://expressjs.com/), [Node.js](https://nodejs.org/) (v20+ / v22+)
- **TypeScript Runtime**: [tsx](https://github.com/privatenumber/tsx) for execution

---

## Project Structure

```text
├── LICENSE                 # MIT Open Source License (Copyright 2026 Kalpesh Babar)
├── README.md               # Project documentation
├── index.html              # HTML entry point with SEO, Open Graph & Schema.org JSON-LD
├── package.json            # Project dependencies and operational scripts
├── tsconfig.json           # TypeScript configuration
├── vite.config.ts          # Vite configuration with React and Tailwind CSS v4 plugins
├── server.ts               # Express server (handles /api/admin/login and serves Vite in dev / dist in prod)
├── public/                 # Static assets, branding graphics, and product imagery
└── src/
    ├── App.tsx             # Root component managing section layout and modal states
    ├── main.tsx            # Application entry point mounting React DOM and LanguageProvider
    ├── index.css           # Global Tailwind CSS imports and typography
    ├── components/
    │   ├── admin/          # Admin portal (AdminDashboard.tsx)
    │   ├── layout/         # Header navigation (Navbar.tsx) and Footer (Footer.tsx)
    │   ├── modals/         # Product detail and quotation modals
    │   └── sections/       # Hero, About, Products, Industries, References, Quality, Gallery, Enquiry, Contact
    ├── context/            # LanguageContext.tsx (English / Marathi state and storage sync)
    ├── data/               # Initial catalogues, customer references, and business contact data
    ├── services/           # StorageService.ts (Local persistence layer for enquiries, products, references)
    ├── translations/       # translations.ts (Full English and Marathi translation dictionaries)
    └── types/              # TypeScript interface and type definitions
```

---

## Installation & Setup

### Prerequisites

- **Node.js**: v20.0.0 or higher (Node.js v22 recommended)
- **npm**: v10.0.0 or higher

### 1. Clone the Repository

```bash
git clone https://github.com/bkalpesh/babaenterprises.git
cd babaenterprises
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Environment Configuration

Create a `.env` file in the project root by copying `.env.example`:

```bash
cp .env.example .env
```

Configure the following environment variables as required:

| Variable | Description | Default / Example |
| :--- | :--- | :--- |
| `PORT` | Port for the Node.js / Express server | `3000` |
| `ADMIN_PASSCODE` | Administrative passcode for portal authentication | `your_secure_admin_passcode` |
| `APP_URL` | Base application URL | `http://localhost:3000` |
| `GEMINI_API_KEY` | Optional API key for Gemini integration | — |

> **Security Note:** Never commit `.env` or production credentials to public version control repositories.

---

## Running the Project Locally

### Development Mode

Starts the Express server with Vite middleware mounted on port `3000`:

```bash
npm run dev
```

Open your browser and navigate to:
```text
http://localhost:3000
```

### Production Build

Compile and bundle the client-side assets:

```bash
npm run build
```

Compiled assets are written to the `dist/` directory.

### Running in Production

To run the production server serving the built assets from `dist/`:

```bash
npm start
```

### Type Checking & Linting

Run TypeScript type verification without emitting build files:

```bash
npm run lint
```

---

## Administration Access

1. Open the website in your browser.
2. Click **Admin** in the navigation bar or append `#admin` to the URL:
   ```text
   http://localhost:3000/#admin
   ```
3. Enter the configured `ADMIN_PASSCODE`.
4. Authentication is validated server-side via the `/api/admin/login` endpoint with automatic rate-limiting protection.

---

## Contributing

1. Fork the repository.
2. Create a feature branch:
   ```bash
   git checkout -b feature/your-feature-name
   ```
3. Commit your changes with descriptive commit messages:
   ```bash
   git commit -m "feat: add support for new technical specifications"
   ```
4. Verify that type checks pass:
   ```bash
   npm run lint
   npm run build
   ```
5. Push to your branch and submit a Pull Request.

---

## Licence

This project is open-source software licensed under the **MIT License**.

Copyright (c) 2026 **Kalpesh Babar**. All rights reserved.

See the [LICENSE](LICENSE) file for the complete license text.
