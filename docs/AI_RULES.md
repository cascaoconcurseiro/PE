# AI Rules & Tech Stack

## Tech Stack

- **Framework:** React 19 (functional components + hooks)
- **Language:** TypeScript
- **Build Tool:** Vite
- **Styling:** Tailwind CSS
- **Database:** Dexie.js (Local-First, IndexedDB wrapper)
- **Icons:** Lucide React
- **Charts:** Recharts
- **AI Integration:** Google Generative AI SDK (@google/genai)
- **Formatting/Linting:** ESLint + TypeScript configs

## Development Rules & Guidelines

### 1. Styling & UI
- **Tailwind CSS:** Always use Tailwind utility classes for styling. Avoid inline styles or separate CSS files unless absolutely necessary for complex animations.
- **Components:** Reuse existing UI components located in `src/components/ui/` (e.g., `Card`, `Button`) to maintain design consistency.
- **Responsive Design:** Ensure all views are responsive. Use Tailwind's breakpoints (`md:`, `lg:`) to handle mobile vs. desktop layouts.
- **Dark Mode:** Support dark mode using the `dark:` prefix in Tailwind classes (managed via `ThemeContext`).

### 2. Icons
- **Library:** Use `lucide-react` for all icons.
- **Consistency:** Set a consistent size (usually `w-4 h-4` or `w-5 h-5`) and stroke width matches the text weight.

### 3. Data Persistence (Local-First)
- **Dexie.js:** Use `db.ts` for all database interactions. The application is "Local-First", meaning data lives in the browser's IndexedDB.
- **Live Queries:** Use `useLiveQuery` hook from `dexie-react-hooks` to subscribe to database changes in components.
- **Migrations:** Handle schema changes in the `PeDeMeiaDB` class constructor in `services/db.ts`.

### 4. Charts & Visualization
- **Library:** Use `recharts` for all charts.
- **Responsiveness:** Always wrap charts in `<ResponsiveContainer>` to ensure they adapt to their parent container size.

### 5. Utilities & Helpers
- **Currency:** Always use `formatCurrency` from `src/utils.ts` for displaying monetary values. Handle multi-currency logic using `src/services/currencyService.ts`.
- **Dates:** Use native JavaScript `Date` objects. Use helpers in `src/utils.ts` (e.g., `parseDate`, `isSameMonth`) to handle timezone offsets correctly (specifically YYYY-MM-DD strings).

### 6. Navigation
- **State-Based Routing:** The app currently uses a state-based navigation system (`activeView` in `index.tsx`). Add new views to the `View` enum in `src/types.ts` and handle rendering in the main switch statement.

### 7. File Structure
- `src/components/`: Feature-specific components (e.g., `Transactions.tsx`, `Dashboard.tsx`).
- `src/components/ui/`: Reusable, generic UI atoms.
- `src/services/`: Business logic, database configuration, and external service integrations.
- `src/types.ts`: Centralized TypeScript interfaces and enums.