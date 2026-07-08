# Controle de Produção de Cogumelos

Aplicativo web (PWA) para controle da produção de *Pleurotus*. Feito com React +
Vite + TypeScript, banco e login no Supabase, publicado no GitHub Pages.

Já funcionam: login, tema claro/escuro, layout que se adapta a celular, tablet e
desktop, **Configurações** (variáveis e capacidades, com o teto recalculado ao vivo),
**Formulação** (calculadoras de composto e de spawn — a umidade de cada ingrediente é
digitada na própria tela, com o peso úmido e a água calculados na hora; a cultura líquida
sai em mL considerando densidade 1 L = 1 kg), **Produção** (estoque em livro-razão
e lotes com baixa automática e registro de contaminação; ao criar Spawn/Substrato/Produção
você escolhe o peso por bolsa e o app já mostra o código do lote no formato SW/SO/PR-AAMMDD),
**Colheita** (registro contínuo por contêiner), **Indicadores** (produção por período em barras
ou acumulada, quebra por turno, aproveitamento do teto, contaminação por lote ao longo do tempo, eficiência biológica, sanidade e
exportação em PNG, PDF e CSV) e o **Assistente de produção** no Painel — diagnóstico de ocupação,
recomendação do que iniciar hoje para manter o contêiner no teto, projeção da ocupação no tempo
(em linha) e planejador de expansão. No Painel, tocar em **CONTÊINER** ou **SALA DE INCUBAÇÃO**
abre uma página completa com todos os lotes daquele recurso — datas de entrada, saída/pronto
prevista e contaminações, lote a lote.

---

## 1. Rodar no seu computador

Você precisa do **Node.js 20 ou mais novo** instalado (https://nodejs.org).

Dentro da pasta do projeto, abra o terminal e rode:

```bash
npm install        # instala as dependências (só na primeira vez)
npm run dev        # inicia o app em modo desenvolvimento
```

O terminal vai mostrar um endereço tipo `http://localhost:5173`. Abra no navegador.
Ainda sem o Supabase configurado (passo 2), a tela de login avisa que falta a
conexão — isso é esperado.

Outros comandos úteis:

```bash
npm run build      # gera a versão final na pasta dist/
npm run preview    # testa a versão final localmente
npm run typecheck  # confere erros de tipo (opcional)
```

---

## 2. Criar o banco no Supabase

1. Crie uma conta gratuita em https://supabase.com e clique em **New project**.
2. Dê um nome, defina uma senha do banco e escolha a região mais próxima.
3. Quando o projeto estiver pronto, vá em **Project Settings → API** e copie:
   - **Project URL**
   - a chave **anon public**
4. Na raiz do projeto, copie o arquivo `.env.example` para um novo arquivo `.env`
   e preencha com esses dois valores:

```
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua-chave-anon-publica
```

> A chave *anon* é pública por natureza — não é segredo. Quem protege os dados é o
> Row Level Security (RLS), que vamos configurar junto com as tabelas no próximo passo.

5. Reinicie o `npm run dev` para ele ler o `.env`.

### Criar o primeiro usuário

Como o acesso é controlado (poucos operadores), os usuários são criados por você,
não por cadastro aberto. No painel do Supabase:

- Vá em **Authentication → Users → Add user**.
- Informe e-mail e senha. Marque para não exigir confirmação de e-mail, se quiser
  facilitar no começo.

Agora dá para entrar no app com esse e-mail e senha.

### Criar as tabelas

No painel do Supabase, vá em **SQL Editor → New query**, abra o arquivo
`supabase/schema.sql` deste projeto, cole todo o conteúdo e clique em **Run**.
Ele cria a tabela de configuração, o histórico de alterações (preenchido
automaticamente) e as regras de segurança. Pode rodar de novo quando quiser — é
seguro. Sem essa etapa, o app calcula normalmente, mas não consegue **salvar** as
configurações.

---

## 3. Publicar no GitHub Pages

1. Crie um repositório no GitHub e envie o projeto (sem a pasta `node_modules`, que
   já está no `.gitignore`):

```bash
git init
git add .
git commit -m "Primeira versão"
git branch -M main
git remote add origin https://github.com/SEU-USUARIO/SEU-REPO.git
git push -u origin main
```

2. No repositório, vá em **Settings → Secrets and variables → Actions → New
   repository secret** e crie os dois segredos (mesmos valores do `.env`):
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`

3. Vá em **Settings → Pages** e, em **Source**, escolha **GitHub Actions**.

4. Pronto. A cada `git push` na branch `main`, o site é reconstruído e publicado
   automaticamente pelo fluxo em `.github/workflows/deploy.yml`. O endereço final
   aparece na aba **Actions** ao terminar (algo como
   `https://SEU-USUARIO.github.io/SEU-REPO/`).

> Como o projeto usa caminhos relativos (`base: './'` no `vite.config.ts`), ele
> funciona em qualquer subpasta do Pages sem você precisar editar o nome do repo.

---

## Como o projeto é organizado

```
src/
  main.tsx            ponto de entrada
  App.tsx             decide entre tela de login e o app
  index.css           sistema de design (cores dos dois temas, componentes)
  lib/supabase.ts     conexão com o Supabase
  context/            tema (claro/escuro) e autenticação
  components/         login, esqueleto do app, navegação, indicador de ocupação
  views/              as telas (Painel, Formulação, Indicadores,
                      Estoque, Colheita, Configurações) e as páginas de
                      detalhe do Contêiner e da Sala de Incubação
  icons/              ícones em SVG (sem biblioteca externa)
```

Para trocar as cores, mexa nas variáveis no topo do `src/index.css`. Para adicionar
uma tela nova, crie o arquivo em `views/` e inclua o item em `components/Nav.tsx`.

---

## Estado do projeto

O ciclo completo está no ar: configurar → formular → produzir (estoque e lotes) →
colher → acompanhar indicadores → decidir com o Assistente. Tudo com histórico auditável
e o teto sustentável guiando as decisões.

Os gráficos exportam em PNG, PDF e CSV. Melhorias possíveis daqui em diante, se quiser:
gráficos de ocupação e de eficiência ao longo do tempo usando o histórico dos lotes, e
refinamentos de multiusuário. É só pedir quando fizer sentido.
