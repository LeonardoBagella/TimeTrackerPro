# TimeTracker Pro - Documentazione Completa per Lovable Cloud

## 📋 Prompt Iniziale per Nuovo Progetto

Copia e incolla questo prompt in un nuovo progetto Lovable:

---

**PROMPT DA USARE:**

```
Crea un'applicazione web chiamata "TimeTracker Pro" per il tracciamento delle ore lavorative su progetti aziendali.

## Funzionalità Principali

1. **Autenticazione**
   - Login con email/password (NO registrazione pubblica, utenti invitati da admin)
   - Pagina login con logo, gradiente viola/blu, QR code per condividere URL

2. **Dashboard Utente**
   - Header con logo orologio, nome utente, pulsante impostazioni, logout
   - Card "Ore Mese Corrente" con totale ore registrate
   - Grafico a torta "Progresso Mensile" (ore registrate vs mancanti, basato su giorni lavorativi × 8h)
   - Switch per vedere mese corrente o precedente
   - Lista progetti con colore, nome, ore personali/totali del mese
   - Lista "Voci Mancanti" (giorni lavorativi con meno di 8h)
   - Lista "Voci Recenti" (ultime 5 registrazioni)

3. **Gestione Progetti**
   - Dialog con tab "Crea Nuovo" (solo admin/project_owner) e "Unisciti"
   - Campi: nome, descrizione, budget (€), colore (8 preset)
   - Click su progetto → apre dialog registra ore pre-compilato

4. **Registrazione Ore**
   - Dialog con: data, dropdown progetto, slider ore 1-8, tipo attività (Analisi/Sviluppo/Riunione)
   - Validazione: max 10 ore/giorno per utente
   - Tipo attività default da profilo utente

5. **Report Admin** (solo ruolo admin)
   - Grafico budget vs costo effettivo per progetto
   - Tabella registrazioni ultimi 3 mesi con ricerca e paginazione
   - Export Excel

6. **Multi-tenancy**
   - Utenti raggruppati per organizzazione
   - Ogni utente vede solo progetti/dati della propria organizzazione

## Ruoli Utente
- `user`: può registrare ore sui progetti a cui appartiene
- `admin`: può vedere report di tutti, gestire ruoli
- `project_owner`: può creare nuovi progetti

## Design
- Gradiente primario viola/blu
- Font moderno
- Componenti shadcn/ui
- Responsive (mobile-first)

Usa Lovable Cloud per il database.
```

---

## 🗄️ Schema Database Completo

### STEP 1: Crea l'Enum per i Ruoli

```sql
CREATE TYPE public.app_role AS ENUM ('user', 'admin', 'project_owner');
```

### STEP 2: Crea le Tabelle

```sql
-- Tabella Organizations
CREATE TABLE public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabella Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  organization_id UUID REFERENCES public.organizations(id),
  display_name TEXT,
  daily_cost INTEGER,
  default_task_type TEXT NOT NULL DEFAULT 'development',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabella User Roles
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

-- Tabella Projects
CREATE TABLE public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  organization_id UUID REFERENCES public.organizations(id),
  name TEXT NOT NULL,
  description TEXT,
  color TEXT NOT NULL DEFAULT '#3b82f6',
  budget INTEGER,
  closed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabella Project Members
CREATE TABLE public.project_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (project_id, user_id)
);

-- Tabella Time Entries
CREATE TABLE public.time_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  hours NUMERIC NOT NULL,
  description TEXT NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
```

### STEP 3: Crea le Funzioni Helper

```sql
-- Funzione per ottenere l'organizzazione dell'utente
CREATE OR REPLACE FUNCTION public.get_user_organization(_user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT organization_id
  FROM public.profiles
  WHERE user_id = _user_id
$$;

-- Funzione per verificare se l'utente ha un ruolo
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
    AND role = _role
  )
$$;

-- Funzione per verificare se l'utente è membro di un progetto
CREATE OR REPLACE FUNCTION public.is_project_member(_user_id UUID, _project_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.project_members
    WHERE user_id = _user_id
    AND project_id = _project_id
  )
$$;

-- Funzione per aggiornare updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Funzione per creare profilo automaticamente
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));
  RETURN NEW;
END;
$$;

-- Funzione per assegnare ruolo 'user' automaticamente
CREATE OR REPLACE FUNCTION public.handle_new_user_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user');
  RETURN NEW;
END;
$$;

-- Funzione per aggiungere creatore come membro del progetto
CREATE OR REPLACE FUNCTION public.add_creator_as_member()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.project_members (project_id, user_id)
  VALUES (NEW.id, NEW.user_id);
  RETURN NEW;
END;
$$;

-- Funzione per impostare organization_id del progetto
CREATE OR REPLACE FUNCTION public.handle_new_project()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.organization_id IS NULL THEN
    NEW.organization_id := public.get_user_organization(NEW.user_id);
  END IF;
  RETURN NEW;
END;
$$;
```

### STEP 4: Crea i Trigger

```sql
-- Trigger per updated_at su profiles
CREATE TRIGGER update_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger per updated_at su projects
CREATE TRIGGER update_projects_updated_at
BEFORE UPDATE ON public.projects
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger per updated_at su time_entries
CREATE TRIGGER update_time_entries_updated_at
BEFORE UPDATE ON public.time_entries
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger per creare profilo su nuovo utente
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user();

-- Trigger per assegnare ruolo 'user' su nuovo utente
CREATE TRIGGER on_auth_user_role_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user_role();

-- Trigger per aggiungere creatore come membro progetto
CREATE TRIGGER on_project_created_add_member
AFTER INSERT ON public.projects
FOR EACH ROW
EXECUTE FUNCTION public.add_creator_as_member();

-- Trigger per impostare organization_id progetto
CREATE TRIGGER on_project_created_set_org
BEFORE INSERT ON public.projects
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_project();
```

### STEP 5: Abilita RLS e Crea le Policy

```sql
-- Abilita RLS su tutte le tabelle
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.time_entries ENABLE ROW LEVEL SECURITY;

-- POLICIES: organizations
CREATE POLICY "Users can view their own organization"
ON public.organizations FOR SELECT
USING (id = get_user_organization(auth.uid()));

CREATE POLICY "Admins can view all organizations"
ON public.organizations FOR SELECT
USING (has_role(auth.uid(), 'admin'));

-- POLICIES: profiles
CREATE POLICY "Users can view profiles in their organization"
ON public.profiles FOR SELECT
USING (
  (organization_id = get_user_organization(auth.uid())) 
  OR (auth.uid() = user_id)
);

CREATE POLICY "Admins can view all profiles"
ON public.profiles FOR SELECT
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can insert their own profile"
ON public.profiles FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile"
ON public.profiles FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (
  (auth.uid() = user_id) 
  AND (
    (organization_id IS NULL) 
    OR (organization_id = (SELECT p.organization_id FROM profiles p WHERE p.user_id = auth.uid()))
  )
);

-- POLICIES: user_roles
CREATE POLICY "Users can view their own roles"
ON public.user_roles FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Only admins can insert roles"
ON public.user_roles FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Only admins can delete roles"
ON public.user_roles FOR DELETE
USING (has_role(auth.uid(), 'admin'));

-- POLICIES: projects
CREATE POLICY "Users can view projects in their organization"
ON public.projects FOR SELECT
USING (organization_id = get_user_organization(auth.uid()));

CREATE POLICY "Project owners and admins can create projects"
ON public.projects FOR INSERT
WITH CHECK (
  (auth.uid() = user_id) 
  AND (has_role(auth.uid(), 'project_owner') OR has_role(auth.uid(), 'admin'))
  AND (organization_id = get_user_organization(auth.uid()))
);

CREATE POLICY "Users can update their own projects"
ON public.projects FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own projects"
ON public.projects FOR DELETE
USING (auth.uid() = user_id);

-- POLICIES: project_members
CREATE POLICY "Users can view their project memberships"
ON public.project_members FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Users can join projects in their organization"
ON public.project_members FOR INSERT
WITH CHECK (
  (user_id = auth.uid()) 
  AND (EXISTS (
    SELECT 1 FROM projects p
    WHERE p.id = project_members.project_id
    AND p.organization_id = get_user_organization(auth.uid())
  ))
);

CREATE POLICY "Project creators can add members"
ON public.project_members FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM projects p
  WHERE p.id = project_members.project_id
  AND p.user_id = auth.uid()
));

CREATE POLICY "Project creators can remove members"
ON public.project_members FOR DELETE
USING (EXISTS (
  SELECT 1 FROM projects p
  WHERE p.id = project_members.project_id
  AND p.user_id = auth.uid()
));

-- POLICIES: time_entries
CREATE POLICY "Users can view time entries in their organization"
ON public.time_entries FOR SELECT
USING (EXISTS (
  SELECT 1 FROM projects p
  WHERE p.id = time_entries.project_id
  AND p.organization_id = get_user_organization(auth.uid())
));

CREATE POLICY "Admins can view all time entries"
ON public.time_entries FOR SELECT
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can create time entries in their organization"
ON public.time_entries FOR INSERT
WITH CHECK (
  (auth.uid() = user_id) 
  AND is_project_member(auth.uid(), project_id)
  AND (EXISTS (
    SELECT 1 FROM projects p
    WHERE p.id = time_entries.project_id
    AND p.organization_id = get_user_organization(auth.uid())
  ))
);

CREATE POLICY "Users can update their own time entries"
ON public.time_entries FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own time entries"
ON public.time_entries FOR DELETE
USING (auth.uid() = user_id);
```

---

## 🖥️ Struttura Componenti

```
src/
├── components/
│   ├── AuthPage.tsx          # Pagina login
│   ├── Dashboard.tsx         # Dashboard principale
│   ├── AddProjectDialog.tsx  # Dialog crea/unisciti progetto
│   ├── AddTimeDialog.tsx     # Dialog registra ore
│   ├── AdminReports.tsx      # Report amministratore
│   ├── ProfileSettingsDialog.tsx # Impostazioni profilo
│   └── ui/                   # Componenti shadcn
├── context/
│   ├── AuthContext.tsx       # Contesto autenticazione
│   └── ProjectContext.tsx    # Contesto progetti/time entries
├── hooks/
│   └── useUserRole.tsx       # Hook per ruoli utente
└── utils/
    └── timeCalculations.ts   # Calcolo giorni mancanti
```

---

## 📧 Email Templates Supabase

### Invite User
```html
<!DOCTYPE html>
<html>
<head>
  <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700&display=swap" rel="stylesheet">
</head>
<body style="font-family: 'Poppins', Arial, sans-serif; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); margin: 0; padding: 40px 20px;">
  <div style="max-width: 500px; margin: 0 auto; background: white; border-radius: 20px; padding: 40px; box-shadow: 0 20px 60px rgba(0,0,0,0.3);">
    <div style="text-align: center; margin-bottom: 30px;">
      <div style="width: 70px; height: 70px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 18px; margin: 0 auto 15px; display: flex; align-items: center; justify-content: center;">
        <span style="font-size: 32px;">⏰</span>
      </div>
      <h1 style="color: #333; margin: 0; font-size: 24px;">TimeTracker Pro</h1>
    </div>
    <h2 style="color: #667eea; text-align: center;">🎉 Sei stato invitato!</h2>
    <p style="color: #666; text-align: center; line-height: 1.6;">
      Sei stato invitato a unirti a <strong>TimeTracker Pro</strong>. 
      Clicca il pulsante qui sotto per accettare l'invito e creare il tuo account.
    </p>
    <div style="text-align: center; margin: 30px 0;">
      <a href="{{ .ConfirmationURL }}" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; text-decoration: none; padding: 15px 40px; border-radius: 50px; font-weight: 600; font-size: 16px; box-shadow: 0 10px 30px rgba(102, 126, 234, 0.4);">
        🚀 Accetta Invito
      </a>
    </div>
  </div>
</body>
</html>
```

---

## 🔧 Configurazione Iniziale Dati

Dopo aver creato il database, esegui queste query per configurare i dati iniziali:

```sql
-- Crea un'organizzazione di esempio
INSERT INTO public.organizations (id, name) 
VALUES ('00000000-0000-0000-0000-000000000001', 'La Mia Azienda');

-- Dopo che un utente si registra, assegnagli l'organizzazione e ruoli aggiuntivi:
-- (sostituisci USER_ID con l'UUID dell'utente)

-- Assegna organizzazione
UPDATE public.profiles 
SET organization_id = '00000000-0000-0000-0000-000000000001'
WHERE user_id = 'USER_ID';

-- Assegna ruolo admin
INSERT INTO public.user_roles (user_id, role) 
VALUES ('USER_ID', 'admin');

-- Assegna ruolo project_owner
INSERT INTO public.user_roles (user_id, role) 
VALUES ('USER_ID', 'project_owner');
```

---

## ⚡ Validazioni Business Logic

1. **Max 10 ore/giorno**: Verificare lato client prima di inserire time_entry
2. **Ore 1-8 per registrazione**: Slider limitato
3. **Budget obbligatorio**: Validazione form creazione progetto
4. **Costo giornaliero per calcoli**: daily_cost nel profilo

---

## 🎨 Design Tokens

```css
:root {
  --primary: 262.1 83.3% 57.8%;      /* Viola */
  --accent: 270 76% 45%;              /* Viola scuro */
  --background: 0 0% 100%;            /* Bianco */
  --foreground: 224 71.4% 4.1%;       /* Nero */
  --muted: 220 14.3% 95.9%;           /* Grigio chiaro */
  --destructive: 0 84.2% 60.2%;       /* Rosso */
}
```

### Colori Progetti Predefiniti
```javascript
const colors = [
  '#3b82f6', // Blu
  '#8b5cf6', // Viola
  '#ef4444', // Rosso
  '#10b981', // Verde
  '#f59e0b', // Arancione
  '#ec4899', // Rosa
  '#6366f1', // Indaco
  '#84cc16'  // Lime
];
```

---

## 📱 Breakpoints Responsive

- **Mobile**: < 640px (1 colonna)
- **Tablet**: 640px - 1024px (2 colonne)
- **Desktop**: > 1024px (3 colonne)

---

## 🚀 Checklist Implementazione

- [ ] Creare nuovo progetto Lovable
- [ ] Abilitare Lovable Cloud
- [ ] Eseguire SQL schema (Step 1-5)
- [ ] Configurare email templates
- [ ] Implementare componenti UI
- [ ] Creare organizzazione iniziale
- [ ] Creare primo utente admin
- [ ] Testare flusso completo
