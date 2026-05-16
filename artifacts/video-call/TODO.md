# Video Call Website Improvements - BLACKBOXAI Plan

Current Progress: 0/14 ✅

## Breakdown Steps:

### Phase 1: Theme & Assets (2 steps)
- [ ] 1. Download Union Bank logo SVG to `public/images/union-bank-logo.svg` (green theme ready).
- [ ] 2. Update `src/index.css`: Change primary to bank green `hsl(160 75% 40%)`, add gold accent `hsl(40 90% 55%)`, text-shadow fix.

### Phase 2: CardNav Enhancements (2 steps)
- [x] 3. Edit `src/components/card-nav.tsx`: Increase size (py-6 px-6, icons h-6), fix glow (opacity-75, drop-shadow), add Schedule item, use wouter Link for navigation.
- [x] 4. Update `src/pages/home.tsx`: Hero + new CardNav (4 links: Video/Chat/Schedule/About), remove old sections/scroll.

### Phase 3: New Pages (4 steps)
- [x] 5. Create `src/pages/chat.tsx`: Extract chat/image-analysis from home (ui/form, ui/table for history, modern layout).
- [x] 6. Create `src/pages/schedule.tsx`: ui/calendar + booking form (hostName/date/time → createRoom API), ui/tabs (upcoming/past).
- [x] 7. Edit `src/App.tsx`: Add routes `/chat`, `/schedule`.
- [ ] 8. Edit `src/components/ui/calendar.tsx` if needed for integration.

### Phase 4: Modern UI Polish (3 steps)
- [ ] 9. Home: Add ui/navigation-menu or ui/tabs for nav variety.
- [ ] 10. Chat: ui/badge for langs, ui/drawer mobile history.
- [ ] 11. Schedule: ui/badge status, ui/sheet preview.

### Phase 5: Test & Polish (3 steps)
- [ ] 12. Mobile responsive: Use `hooks/use-mobile.tsx`.
- [ ] 13. Run `npm run dev`, test all routes/call/chat/schedule.
- [ ] 14. **Final:** `attempt_completion`.

**Notes:** 
- No new deps needed (shadcn full).
- Union green theme: Professional banking.
- Track progress: Update this file after each step."

