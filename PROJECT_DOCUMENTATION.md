# TimeTracker Pro - Documentazione Progetto

## 📋 Descrizione Generale

**TimeTracker Pro** è un'applicazione web per la gestione e tracciamento delle ore lavorative su progetti aziendali. Permette agli utenti di registrare il tempo speso su diversi progetti, visualizzare statistiche mensili, e agli amministratori di generare report dettagliati per tutta l'organizzazione.

### Caratteristiche Principali
- 🕐 Tracciamento ore su progetti multipli
- 📊 Grafici a torta per visualizzare il progresso mensile
- ⚠️ Rilevamento automatico giorni lavorativi con ore mancanti
- 👥 Sistema multi-utente con organizzazioni
- 📈 Report amministrativi con export Excel
- 💰 Gestione budget progetti con analisi costi

---

## 🛠️ Stack Tecnologico

- **Frontend**: React 18 + TypeScript + Vite
- **Styling**: Tailwind CSS + shadcn/ui
- **State Management**: React Context API
- **Routing**: React Router DOM v6
- **Grafici**: Recharts
- **Date**: date-fns
- **Export**: xlsx (per export Excel)
- **QR Code**: qrcode.react
- **Backend/Database**: Supabase (PostgreSQL)
- **Autenticazione**: Supabase Auth

---

## 🗄️ Schema Database

### Tabella: `organizations`
Organizzazioni/aziende che raggruppano utenti e progetti.

| Colonna | Tipo | Nullable | Default | Descrizione |
|---------|------|----------|---------|-------------|
| id | UUID | NO | gen_random_uuid() | Chiave primaria |
| name | TEXT | NO | - | Nome organizzazione |
| created_at | TIMESTAMP WITH TIME ZONE | NO | now() | Data creazione |
| updated_at | TIMESTAMP WITH TIME ZONE | NO | now() | Data ultimo aggiornamento |

---

### Tabella: `profiles`
Profili utente con informazioni aggiuntive.

| Colonna | Tipo | Nullable | Default | Descrizione |
|---------|------|----------|---------|-------------|
| id | UUID | NO | gen_random_uuid() | Chiave primaria |
| user_id | UUID | NO | - | FK a auth.users |
| organization_id | UUID | SI | NULL | FK a organizations |
| display_name | TEXT | SI | NULL | Nome visualizzato |
| daily_cost | NUMERIC | SI | NULL | Costo giornaliero (€) per calcolo budget |
| default_task_type | TEXT | NO | 'development' | Tipo attività predefinito |
| created_at | TIMESTAMP WITH TIME ZONE | NO | now() | Data creazione |
| updated_at | TIMESTAMP WITH TIME ZONE | NO | now() | Data ultimo aggiornamento |

**Relazioni**:
- `organization_id` → `organizations.id`

---

### Tabella: `projects`
Progetti su cui gli utenti possono registrare ore.

| Colonna | Tipo | Nullable | Default | Descrizione |
|---------|------|----------|---------|-------------|
| id | UUID | NO | gen_random_uuid() | Chiave primaria |
| user_id | UUID | NO | - | FK a auth.users (creatore) |
| organization_id | UUID | SI | NULL | FK a organizations |
| name | TEXT | NO | - | Nome progetto |
| description | TEXT | SI | NULL | Descrizione progetto |
| color | TEXT | NO | '#3b82f6' | Colore identificativo (HEX) |
| budget | NUMERIC | SI | NULL | Budget totale in euro |
| closed_at | TIMESTAMP WITH TIME ZONE | SI | NULL | Data chiusura (NULL = aperto) |
| created_at | TIMESTAMP WITH TIME ZONE | NO | now() | Data creazione |
| updated_at | TIMESTAMP WITH TIME ZONE | NO | now() | Data ultimo aggiornamento |

**Relazioni**:
- `organization_id` → `organizations.id`

---

### Tabella: `project_members`
Associazione molti-a-molti tra utenti e progetti.

| Colonna | Tipo | Nullable | Default | Descrizione |
|---------|------|----------|---------|-------------|
| id | UUID | NO | gen_random_uuid() | Chiave primaria |
| project_id | UUID | NO | - | FK a projects |
| user_id | UUID | NO | - | FK a auth.users |
| created_at | TIMESTAMP WITH TIME ZONE | NO | now() | Data creazione |

**Relazioni**:
- `project_id` → `projects.id`

---

### Tabella: `time_entries`
Registrazioni ore lavorate.

| Colonna | Tipo | Nullable | Default | Descrizione |
|---------|------|----------|---------|-------------|
| id | UUID | NO | gen_random_uuid() | Chiave primaria |
| user_id | UUID | NO | - | FK a auth.users |
| project_id | UUID | NO | - | FK a projects |
| hours | NUMERIC | NO | - | Ore lavorate (1-8) |
| description | TEXT | NO | - | Tipo attività (Analisi/Sviluppo/Riunione) |
| date | DATE | NO | CURRENT_DATE | Data della registrazione |
| created_at | TIMESTAMP WITH TIME ZONE | NO | now() | Data creazione |
| updated_at | TIMESTAMP WITH TIME ZONE | NO | now() | Data ultimo aggiornamento |

**Relazioni**:
- `project_id` → `projects.id`

**Vincoli**:
- Massimo 10 ore al giorno per utente (validazione lato applicazione)

---

### Tabella: `user_roles`
Ruoli assegnati agli utenti.

| Colonna | Tipo | Nullable | Default | Descrizione |
|---------|------|----------|---------|-------------|
| id | UUID | NO | gen_random_uuid() | Chiave primaria |
| user_id | UUID | NO | - | FK a auth.users |
| role | app_role (ENUM) | NO | - | Ruolo assegnato |
| created_at | TIMESTAMP WITH TIME ZONE | NO | now() | Data creazione |

**Enum `app_role`**:
- `user` - Utente base, può solo registrare ore
- `admin` - Amministratore, può vedere report di tutti gli utenti dell'organizzazione
- `project_owner` - Proprietario progetti, può creare nuovi progetti

---

### Funzioni Database

```sql
-- Ottiene l'organization_id dell'utente
CREATE FUNCTION get_user_organization(_user_id UUID) RETURNS UUID

-- Verifica se l'utente ha un determinato ruolo
CREATE FUNCTION has_role(_role app_role, _user_id UUID) RETURNS BOOLEAN

-- Verifica se l'utente è membro di un progetto
CREATE FUNCTION is_project_member(_project_id UUID, _user_id UUID) RETURNS BOOLEAN
```

---

## 🔐 Row Level Security (RLS)

### Politiche Principali

**profiles**:
- Gli utenti possono vedere/modificare solo il proprio profilo
- Gli admin possono vedere i profili della propria organizzazione

**projects**:
- Gli utenti vedono solo i progetti della propria organizzazione
- Solo project_owner e admin possono creare progetti

**time_entries**:
- Gli utenti possono vedere/modificare solo le proprie registrazioni
- Gli admin possono vedere tutte le registrazioni dell'organizzazione

**project_members**:
- Gli utenti possono unirsi ai progetti della propria organizzazione

---

## 🖥️ Interfacce Utente

### 1. Pagina di Login (`AuthPage`)
- Form login con email e password
- Logo e branding "TimeTracker Pro"
- QR Code per condividere l'URL dell'app
- Gradiente viola/blu come sfondo
- **Nota**: Solo login, nessuna registrazione pubblica (utenti creati da admin)

### 2. Dashboard Principale (`Dashboard`)

#### Header
- Logo con icona orologio
- Nome utente (display_name o email)
- Pulsante impostazioni profilo
- Pulsante logout

#### Pulsanti Azione
- "Aggiungi Progetto" - Apre dialog per creare/unirsi a progetti
- "Registra Ore" - Apre dialog per registrare tempo
- "Report Admin" - Solo per admin, apre sezione report

#### Card Statistiche
1. **Ore Mese Corrente**: Totale ore registrate dall'utente nel mese
2. **Progresso Mensile**: Grafico a torta (ore registrate vs ore mancanti)
   - Switch per vedere mese corrente o precedente
   - Calcolo: giorni lavorativi × 8 ore = ore attese

#### Sezioni Principali (3 colonne)
1. **Lista Progetti**
   - Card per ogni progetto con colore, nome, descrizione
   - Badge con "Tue ore / Ore totali" del mese
   - Click su progetto → apre dialog registra ore pre-compilato
   - Pulsante elimina progetto

2. **Possibili Voci Mancanti**
   - Lista giorni lavorativi (lun-ven) con meno di 8 ore
   - Ultimo mese di storico
   - Click su giorno → apre dialog registra ore pre-compilato

3. **Voci Recenti**
   - Ultime 5 registrazioni dell'utente
   - Data, progetto, descrizione, ore
   - Pulsante elimina registrazione

### 3. Dialog Aggiungi Progetto (`AddProjectDialog`)

#### Tab "Crea Nuovo" (solo per project_owner/admin)
- Input nome progetto (obbligatorio)
- Textarea descrizione (opzionale)
- Input budget in euro (obbligatorio)
- Selezione colore (8 colori predefiniti)

#### Tab "Unisciti"
- Lista progetti disponibili nell'organizzazione
- Filtrati: progetti aperti a cui l'utente non è già membro
- Pulsante "Unisciti" per ogni progetto

### 4. Dialog Registra Ore (`AddTimeDialog`)
- Selettore data (pre-compilabile)
- Dropdown selezione progetto (pre-compilabile)
- Slider ore (1-8, step 1, default 4)
- Combobox tipo attività:
  - Analisi
  - Sviluppo
  - Riunione
- Default tipo attività da profilo utente

### 5. Dialog Impostazioni Profilo (`ProfileSettingsDialog`)
- Input display name (modificabile)
- Email (solo visualizzazione)

### 6. Report Amministratore (`AdminReports`)
Solo accessibile agli utenti con ruolo `admin`.

#### Grafico Budget vs Costo
- Grafico a barre orizzontali
- Budget allocato vs Costo effettivo per progetto
- Costo calcolato: (ore / 8) × costo_giornaliero_utente

#### Tabella Registrazioni
- Ultimi 3 mesi di registrazioni
- Colonne: Data, Progetto, Utente, Descrizione, Ore
- Ricerca per progetto/utente/descrizione
- Paginazione (20 elementi per pagina)
- Export Excel con tutti i dati filtrati

---

## 📧 Email Templates

L'applicazione utilizza i seguenti template email Supabase personalizzati:

1. **Invite User** - Invito nuovi utenti all'organizzazione
2. **Confirm Signup** - Conferma registrazione email
3. **Reset Password** - Reset password
4. **Magic Link** - Login senza password

Tutti i template hanno uno stile coerente:
- Font: Poppins (Google Fonts)
- Gradiente primario: #667eea → #764ba2
- Design moderno con emoji e bottoni arrotondati

---

## 🔧 Logica Applicativa

### Calcolo Ore Mancanti
```typescript
// Ultimi 30 giorni, solo giorni lavorativi (lun-ven)
// Giorni con meno di 8 ore registrate
```

### Validazione Ore Giornaliere
- Massimo 10 ore al giorno per utente
- Controllo lato server prima dell'inserimento

### Calcolo Progresso Mensile
- Giorni lavorativi nel mese × 8 = Ore attese
- Ore registrate / Ore attese = Percentuale completamento

### Calcolo Costo Progetto (Admin)
```typescript
// Per ogni time_entry del progetto:
// (entry.hours / 8) × profile.daily_cost
// Somma tutti i costi
```

---

## 🎨 Design System

### Colori Principali
```css
--primary: HSL viola/blu (gradiente)
--accent: HSL viola più scuro
--background: Bianco/Grigio chiaro
--foreground: Grigio scuro
--destructive: Rosso per errori/eliminazione
```

### Colori Progetti Predefiniti
```javascript
['#3b82f6', '#8b5cf6', '#ef4444', '#10b981', 
 '#f59e0b', '#ec4899', '#6366f1', '#84cc16']
```

---

## 📱 Responsive Design

L'applicazione è completamente responsive:
- Desktop: Layout a 3 colonne
- Tablet: Layout a 2 colonne
- Mobile: Layout a 1 colonna, pulsanti stack verticale

---

## 🚀 Istruzioni per Ricreare su Lovable Cloud

1. **Crea nuovo progetto Lovable**

2. **Abilita Lovable Cloud** (database integrato)

3. **Crea le tabelle del database** seguendo lo schema sopra

4. **Configura l'autenticazione**:
   - Abilita email/password auth
   - Configura i template email

5. **Implementa le RLS policies** per sicurezza

6. **Crea le funzioni database** per helper queries

7. **Implementa i componenti** seguendo la struttura delle interfacce

8. **Configura i ruoli utente** creando manualmente gli utenti admin

---

## 📝 Note Importanti

- Gli utenti non si registrano autonomamente, vengono invitati via email
- Ogni utente appartiene a una sola organizzazione
- I progetti sono condivisi all'interno dell'organizzazione
- Il budget è in euro e serve per il confronto costi nei report admin
- Il costo giornaliero dell'utente è configurato nel profilo
