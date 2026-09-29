# Project Custom Instructions

## ClickUp
**Усі** задачі по цьому проєкту (баги, доопрацювання, деплой, інфраструктура) ведемо в одному списку:
- Workspace `30355716`, простір **VIASECURITY** (`54397617`), список `901222691150` — https://app.clickup.com/30355716/v/li/901222691150
- Статуси: `Open → in progress → qa → Closed`
- Виконавець за замовчуванням: Артем (`48445729`)
- Задачі по розгортанню на srv — підзадачі «Деплой education-platform на srv» (`869f91cxt`)
- У commit message — тег `#taskID[статус]` (напр. `#869f94n8z[qa]`)

## User Experience Updates
**CRITICAL RULE:** Whenever you implement or modify functionality that affects the user's experience in this application (i.e. anything non-technical that the user can interact with or see), you **MUST** also update the "Про додаток" (About the App) section located in `src/components/AboutApp.tsx`. 

This ensures that the documentation within the app is always up-to-date with its actual capabilities. Keep the descriptions in Ukrainian, using clear, non-technical language tailored for end-users, and follow the existing UI structure (cards, icons from `lucide-react`, Tailwind classes).
