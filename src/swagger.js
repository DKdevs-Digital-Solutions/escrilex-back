
function buildV5Paths() {
  const authRequired = [{ bearerAuth: [] }];
  return {
    "/api/expectation-matrix/options": {
      get: {
        tags: ["Matriz de Expectativas"],
        summary: "Metadados, colunas, opções e usuários da Matriz de Expectativas",
        security: authRequired,
        responses: { 200: { description: "Opções retornadas" } },
      },
    },
    "/api/expectation-matrix": {
      get: {
        tags: ["Matriz de Expectativas"],
        summary: "Listar a Matriz de Expectativas em formato de tabela",
        security: authRequired,
        parameters: [
          { name: "search", in: "query", schema: { type: "string" } },
          { name: "status", in: "query", schema: { type: "string" } },
          { name: "grupo", in: "query", schema: { type: "string" } },
          { name: "tributacao", in: "query", schema: { type: "string" } },
          { name: "ramo", in: "query", schema: { type: "string" } },
          { name: "perfil", in: "query", schema: { type: "string" } },
          { name: "limit", in: "query", schema: { type: "integer" } },
          { name: "offset", in: "query", schema: { type: "integer" } },
        ],
        responses: { 200: { description: "Linhas retornadas" } },
      },
    },
    "/api/expectation-matrix/{companyId}": {
      get: {
        tags: ["Matriz de Expectativas"],
        summary: "Detalhar linha da Matriz de Expectativas por empresa",
        security: authRequired,
        parameters: [{ name: "companyId", in: "path", required: true, schema: { type: "string" } }],
        responses: { 200: { description: "Linha retornada" } },
      },
      put: {
        tags: ["Matriz de Expectativas"],
        summary: "Editar dados base da Matriz de Expectativas",
        security: authRequired,
        parameters: [{ name: "companyId", in: "path", required: true, schema: { type: "string" } }],
        requestBody: { required: true, content: { "application/json": { schema: { type: "object" } } } },
        responses: { 200: { description: "Linha atualizada" } },
      },
      patch: {
        tags: ["Matriz de Expectativas"],
        summary: "Editar parcialmente dados base da Matriz de Expectativas",
        security: authRequired,
        parameters: [{ name: "companyId", in: "path", required: true, schema: { type: "string" } }],
        requestBody: { required: true, content: { "application/json": { schema: { type: "object" } } } },
        responses: { 200: { description: "Linha atualizada" } },
      },
    },
    "/api/dashboard/details": {
      get: {
        tags: ["Dashboard"],
        summary: "Drill-down dos indicadores do dashboard",
        security: authRequired,
        parameters: [
          { name: "type", in: "query", required: true, schema: { type: "string", enum: ["entries", "exits", "alterations", "tributacao", "ramo", "perfil", "status", "responsible"] } },
          { name: "value", in: "query", schema: { type: "string" } },
          { name: "startDate", in: "query", schema: { type: "string", format: "date-time" } },
          { name: "endDate", in: "query", schema: { type: "string", format: "date-time" } },
          { name: "limit", in: "query", schema: { type: "integer" } },
          { name: "offset", in: "query", schema: { type: "integer" } },
        ],
        responses: { 200: { description: "Detalhamento retornado" } },
      },
    },
    "/api/companies/{id}/client-contacts": {
      get: {
        tags: ["Empresas - Contatos internos do cliente"],
        summary: "Listar responsáveis internos no cliente",
        security: authRequired,
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { 200: { description: "Contatos retornados" } },
      },
      post: {
        tags: ["Empresas - Contatos internos do cliente"],
        summary: "Cadastrar responsável interno no cliente",
        security: authRequired,
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["area", "name"], properties: { area: { type: "string", enum: ["Folha", "Fiscal", "Contábil", "Financeiro"] }, name: { type: "string" }, email: { type: "string" }, phone: { type: "string" } } } } } },
        responses: { 201: { description: "Contato criado" } },
      },
    },
    "/api/companies/{id}/client-contacts/{contactId}": {
      put: {
        tags: ["Empresas - Contatos internos do cliente"],
        summary: "Editar responsável interno no cliente",
        security: authRequired,
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
          { name: "contactId", in: "path", required: true, schema: { type: "string" } },
        ],
        requestBody: { required: true, content: { "application/json": { schema: { type: "object" } } } },
        responses: { 200: { description: "Contato atualizado" } },
      },
      delete: {
        tags: ["Empresas - Contatos internos do cliente"],
        summary: "Excluir responsável interno no cliente",
        security: authRequired,
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
          { name: "contactId", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: { 200: { description: "Contato removido" } },
      },
    },
  };
}

function buildPaths() {
  const authRequired = [{ bearerAuth: [] }];
  const adminRequired = [{ bearerAuth: [] }];

  return {
    "/health": {
      get: {
        tags: ["Sistema"],
        summary: "Health check",
        responses: { 200: { description: "API online" } },
      },
    },
    "/api/auth/login": {
      post: {
        tags: ["Autenticação"],
        summary: "Autenticar usuário",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["email", "password"],
                properties: {
                  email: { type: "string", format: "email" },
                  password: { type: "string" },
                },
              },
            },
          },
        },
        responses: { 200: { description: "Login realizado" } },
      },
    },
    "/api/auth/me": {
      get: {
        tags: ["Autenticação"],
        summary: "Usuário autenticado",
        security: authRequired,
        responses: { 200: { description: "Usuário atual" } },
      },
    },
    "/api/dashboard/summary": {
      get: {
        tags: ["Dashboard"],
        summary: "Resumo do dashboard",
        description: "Clientes novos são contados por dataCadastro. Clientes que saíram são clientes inativos contados por inactivatedAt.",
        security: authRequired,
        parameters: [
          { name: "startDate", in: "query", schema: { type: "string", format: "date-time" } },
          { name: "endDate", in: "query", schema: { type: "string", format: "date-time" } },
        ],
        responses: { 200: { description: "Resumo retornado" } },
      },
    },
    "/api/admin/users": {
      get: {
        tags: ["Admin - Usuários"],
        summary: "Listar usuários",
        security: adminRequired,
        parameters: [{ name: "search", in: "query", schema: { type: "string" } }],
        responses: { 200: { description: "Lista de usuários" } },
      },
      post: {
        tags: ["Admin - Usuários"],
        summary: "Cadastrar usuário",
        security: adminRequired,
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["name", "email", "password"],
                properties: {
                  name: { type: "string" },
                  email: { type: "string", format: "email" },
                  password: { type: "string" },
                  sectorId: { type: "string" },
                  roles: { type: "array", items: { type: "string", enum: ["ADMIN", "GESTOR_EMPRESA", "OPERADOR", "LEITURA"] } },
                },
              },
            },
          },
        },
        responses: { 201: { description: "Usuário criado" } },
      },
    },
    "/api/admin/users/{id}": {
      put: {
        tags: ["Admin - Usuários"],
        summary: "Editar usuário",
        security: adminRequired,
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        requestBody: { required: true, content: { "application/json": { schema: { type: "object" } } } },
        responses: { 200: { description: "Usuário atualizado" } },
      },
      delete: {
        tags: ["Admin - Usuários"],
        summary: "Desativar usuário",
        security: adminRequired,
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { 200: { description: "Usuário desativado" } },
      },
    },
    "/api/admin/sectors": {
      get: {
        tags: ["Admin - Setores"],
        summary: "Listar setores",
        security: adminRequired,
        parameters: [{ name: "search", in: "query", schema: { type: "string" } }],
        responses: { 200: { description: "Lista de setores" } },
      },
      post: {
        tags: ["Admin - Setores"],
        summary: "Cadastrar setor",
        security: adminRequired,
        requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["name"], properties: { name: { type: "string" } } } } } },
        responses: { 201: { description: "Setor criado" } },
      },
    },
    "/api/admin/sectors/{id}": {
      put: {
        tags: ["Admin - Setores"],
        summary: "Editar setor",
        security: adminRequired,
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        requestBody: { required: true, content: { "application/json": { schema: { type: "object", properties: { name: { type: "string" } } } } } },
        responses: { 200: { description: "Setor atualizado" } },
      },
      delete: {
        tags: ["Admin - Setores"],
        summary: "Desativar setor",
        security: adminRequired,
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { 200: { description: "Setor desativado" } },
      },
    },
    "/api/admin/sectors/{id}/activate": {
      put: {
        tags: ["Admin - Setores"],
        summary: "Reativar setor",
        security: adminRequired,
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { 200: { description: "Setor reativado" } },
      },
    },
    "/api/admin/audit": {
      get: {
        tags: ["Admin - Auditoria"],
        summary: "Listar auditoria",
        security: adminRequired,
        parameters: [
          { name: "entity", in: "query", schema: { type: "string" } },
          { name: "entityId", in: "query", schema: { type: "string" } },
          { name: "action", in: "query", schema: { type: "string" } },
          { name: "limit", in: "query", schema: { type: "integer" } },
          { name: "offset", in: "query", schema: { type: "integer" } },
        ],
        responses: { 200: { description: "Eventos de auditoria" } },
      },
    },
    "/api/admin/email-account": {
      get: {
        tags: ["Admin - E-mail"],
        summary: "Consultar conta única de e-mail",
        security: adminRequired,
        responses: { 200: { description: "Conta cadastrada ou null" } },
      },
      post: {
        tags: ["Admin - E-mail"],
        summary: "Cadastrar conta única de e-mail",
        security: adminRequired,
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["host", "port", "username", "password", "fromEmail"],
                properties: {
                  host: { type: "string" },
                  port: { type: "integer" },
                  secure: { type: "boolean" },
                  username: { type: "string" },
                  password: { type: "string" },
                  fromEmail: { type: "string", format: "email" },
                  fromName: { type: "string" },
                  active: { type: "boolean" },
                },
              },
            },
          },
        },
        responses: { 201: { description: "Conta criada" }, 409: { description: "Já existe conta cadastrada" } },
      },
      put: {
        tags: ["Admin - E-mail"],
        summary: "Editar conta única de e-mail",
        security: adminRequired,
        requestBody: { required: true, content: { "application/json": { schema: { type: "object" } } } },
        responses: { 200: { description: "Conta atualizada" } },
      },
      delete: {
        tags: ["Admin - E-mail"],
        summary: "Excluir conta única de e-mail",
        security: adminRequired,
        responses: { 200: { description: "Conta removida" } },
      },
    },
    "/api/lookup/sectors": {
      get: {
        tags: ["Lookup"],
        summary: "Listar setores ativos",
        security: authRequired,
        responses: { 200: { description: "Setores ativos" } },
      },
    },
    "/api/lookup/users": {
      get: {
        tags: ["Lookup"],
        summary: "Listar usuários ativos",
        security: authRequired,
        responses: { 200: { description: "Usuários ativos" } },
      },
    },
    "/api/companies": {
      get: {
        tags: ["Empresas"],
        summary: "Listar empresas",
        security: authRequired,
        parameters: [
          { name: "search", in: "query", schema: { type: "string" } },
          { name: "active", in: "query", schema: { type: "boolean" } },
        ],
        responses: { 200: { description: "Lista de empresas" } },
      },
      post: {
        tags: ["Empresas"],
        summary: "Cadastrar empresa",
        security: authRequired,
        requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["cnpj"], properties: { cnpj: { type: "string" }, razaoSocial: { type: "string" }, nomeFantasia: { type: "string" }, dataCadastro: { type: "string", format: "date-time" } } } } } },
        responses: { 201: { description: "Empresa criada" } },
      },
    },
    "/api/companies/responsibles/by-cnpj": {
      get: {
        tags: ["Empresas"],
        summary: "Responsáveis por CNPJ",
        security: authRequired,
        parameters: [{ name: "cnpj", in: "query", required: true, schema: { type: "string" } }],
        responses: { 200: { description: "Responsáveis encontrados" } },
      },
    },
    "/api/companies/{id}": {
      get: {
        tags: ["Empresas"],
        summary: "Detalhar empresa",
        security: authRequired,
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { 200: { description: "Empresa detalhada" } },
      },
      put: {
        tags: ["Empresas"],
        summary: "Editar empresa",
        security: authRequired,
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        requestBody: { required: true, content: { "application/json": { schema: { type: "object" } } } },
        responses: { 200: { description: "Empresa atualizada" } },
      },
      delete: {
        tags: ["Empresas"],
        summary: "Inativar empresa",
        security: authRequired,
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { 200: { description: "Empresa inativada" } },
      },
    },
    "/api/companies/{id}/status": {
      patch: {
        tags: ["Empresas"],
        summary: "Alterar status da empresa",
        security: authRequired,
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["active"], properties: { active: { type: "boolean" } } } } } },
        responses: { 200: { description: "Status alterado" } },
      },
    },
    "/api/companies/{id}/checklists": {
      get: {
        tags: ["Empresas"],
        summary: "Listar checklists da empresa",
        security: authRequired,
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
          { name: "type", in: "query", schema: { type: "string", enum: ["ENTRADA", "SAIDA"] } },
        ],
        responses: { 200: { description: "Checklists da empresa" } },
      },
    },
    "/api/companies/{id}/responsibles": {
      get: {
        tags: ["Empresas"],
        summary: "Listar responsáveis por setor",
        security: authRequired,
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { 200: { description: "Responsáveis da empresa" } },
      },
      put: {
        tags: ["Empresas"],
        summary: "Definir responsáveis por setor, permitindo múltiplos e-mails/usuários por setor",
        security: authRequired,
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["responsibles"],
                properties: {
                  reason: { type: "string" },
                  responsibles: {
                    type: "array",
                    items: {
                      type: "object",
                      required: ["sectorId"],
                      properties: {
                        sectorId: { type: "string" },
                        userId: { type: "string", description: "Compatibilidade com o formato antigo" },
                        userIds: { type: "array", items: { type: "string" } },
                        email: { type: "string", format: "email" },
                        emails: { type: "array", items: { type: "string", format: "email" } },
                        users: {
                          type: "array",
                          items: {
                            type: "object",
                            properties: {
                              userId: { type: "string" },
                              email: { type: "string", format: "email" },
                            },
                          },
                        },
                      },
                    },
                  },
                },
                example: {
                  reason: "Carteira atualizada",
                  responsibles: [
                    { sectorId: "SETOR_ID_FISCAL", userIds: ["USER_ID_1", "USER_ID_2"] },
                    { sectorId: "SETOR_ID_CONTABIL", emails: ["analista1@empresa.com", "analista2@empresa.com"] },
                  ],
                },
              },
            },
          },
        },
        responses: { 200: { description: "Responsáveis atualizados" } },
      },
    },
    "/api/companies/{id}/partners": {
      get: {
        tags: ["Empresas - Sócios"],
        summary: "Listar sócios",
        security: authRequired,
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { 200: { description: "Sócios da empresa" } },
      },
      post: {
        tags: ["Empresas - Sócios"],
        summary: "Cadastrar sócio",
        security: authRequired,
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        requestBody: { required: true, content: { "application/json": { schema: { type: "object" } } } },
        responses: { 201: { description: "Sócio criado" } },
      },
    },
    "/api/companies/{id}/partners/{partnerId}": {
      put: {
        tags: ["Empresas - Sócios"],
        summary: "Editar sócio",
        security: authRequired,
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
          { name: "partnerId", in: "path", required: true, schema: { type: "string" } },
        ],
        requestBody: { required: true, content: { "application/json": { schema: { type: "object" } } } },
        responses: { 200: { description: "Sócio atualizado" } },
      },
      delete: {
        tags: ["Empresas - Sócios"],
        summary: "Excluir sócio",
        security: authRequired,
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
          { name: "partnerId", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: { 200: { description: "Sócio removido" } },
      },
    },
    "/api/integrations/cnpj/{cnpj}": {
      get: {
        tags: ["Integrações"],
        summary: "Consultar CNPJ",
        security: authRequired,
        parameters: [{ name: "cnpj", in: "path", required: true, schema: { type: "string" } }],
        responses: { 200: { description: "Dados do CNPJ" } },
      },
    },
    "/api/templates": {
      get: {
        tags: ["Templates"],
        summary: "Listar templates",
        security: authRequired,
        responses: { 200: { description: "Lista de templates" } },
      },
      post: {
        tags: ["Templates"],
        summary: "Criar template",
        security: authRequired,
        requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["type", "name"], properties: { type: { type: "string", enum: ["ENTRADA", "SAIDA"] }, name: { type: "string" } } } } } },
        responses: { 201: { description: "Template criado" } },
      },
    },
    "/api/templates/default/by-type/{type}": {
      get: {
        tags: ["Templates"],
        summary: "Template padrão por tipo",
        security: authRequired,
        parameters: [{ name: "type", in: "path", required: true, schema: { type: "string", enum: ["ENTRADA", "SAIDA"] } }],
        responses: { 200: { description: "Template padrão" } },
      },
    },
    "/api/templates/{id}": {
      get: {
        tags: ["Templates"],
        summary: "Detalhar template",
        security: authRequired,
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { 200: { description: "Template detalhado" } },
      },
      put: {
        tags: ["Templates"],
        summary: "Editar template",
        security: authRequired,
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        requestBody: { required: true, content: { "application/json": { schema: { type: "object" } } } },
        responses: { 200: { description: "Template atualizado" } },
      },
    },
    "/api/templates/{id}/sections": {
      post: {
        tags: ["Templates - Seções"],
        summary: "Criar seção",
        security: authRequired,
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["name"], properties: { name: { type: "string" }, order: { type: "integer" } } } } } },
        responses: { 201: { description: "Seção criada" } },
      },
    },
    "/api/templates/sections/{sectionId}": {
      put: {
        tags: ["Templates - Seções"],
        summary: "Editar seção",
        security: authRequired,
        parameters: [{ name: "sectionId", in: "path", required: true, schema: { type: "string" } }],
        requestBody: { required: true, content: { "application/json": { schema: { type: "object" } } } },
        responses: { 200: { description: "Seção atualizada" } },
      },
      delete: {
        tags: ["Templates - Seções"],
        summary: "Excluir seção",
        security: authRequired,
        parameters: [{ name: "sectionId", in: "path", required: true, schema: { type: "string" } }],
        responses: { 200: { description: "Seção removida" } },
      },
    },
    "/api/templates/{id}/items": {
      post: {
        tags: ["Templates - Itens"],
        summary: "Criar item",
        security: authRequired,
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        requestBody: { required: true, content: { "application/json": { schema: { type: "object" } } } },
        responses: { 201: { description: "Item criado" } },
      },
    },
    "/api/templates/items/{itemId}": {
      put: {
        tags: ["Templates - Itens"],
        summary: "Editar item",
        security: authRequired,
        parameters: [{ name: "itemId", in: "path", required: true, schema: { type: "string" } }],
        requestBody: { required: true, content: { "application/json": { schema: { type: "object" } } } },
        responses: { 200: { description: "Item atualizado" } },
      },
      delete: {
        tags: ["Templates - Itens"],
        summary: "Excluir item",
        security: authRequired,
        parameters: [{ name: "itemId", in: "path", required: true, schema: { type: "string" } }],
        responses: { 200: { description: "Item removido" } },
      },
    },
    "/api/checklists/run/{runId}": {
      get: {
        tags: ["Checklists"],
        summary: "Detalhar execução do checklist",
        security: authRequired,
        parameters: [{ name: "runId", in: "path", required: true, schema: { type: "string" } }],
        responses: { 200: { description: "Execução retornada" } },
      },
    },
    "/api/checklists/start": {
      post: {
        tags: ["Checklists"],
        summary: "Iniciar checklist",
        security: authRequired,
        requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["companyId", "type"], properties: { companyId: { type: "string" }, templateId: { type: "string" }, type: { type: "string", enum: ["ENTRADA", "SAIDA"] } } } } } },
        responses: { 201: { description: "Checklist iniciado" } },
      },
    },
    "/api/checklists/item/{itemRunId}": {
      patch: {
        tags: ["Checklists"],
        summary: "Atualizar item do checklist",
        security: authRequired,
        parameters: [{ name: "itemRunId", in: "path", required: true, schema: { type: "string" } }],
        requestBody: { required: true, content: { "application/json": { schema: { type: "object", properties: { status: { type: "string", enum: ["PENDENTE", "EM_ANDAMENTO", "CONCLUIDO", "NA", "FEITO"] }, observation: { type: "string", nullable: true } } } } } },
        responses: { 200: { description: "Item atualizado" } },
      },
    },
  };
}

export function buildOpenApiSpec() {
  return {
    openapi: "3.0.3",
    info: {
      title: "Escrilex Back API",
      version: "1.0.0",
      description: "Documentação das chamadas disponíveis do backend, incluindo dashboard, empresas, checklists, templates, integração e configuração única de e-mail.",
    },
    servers: [{ url: "https://escrilex-back.onrender.com" }],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
    },
    paths: { ...buildPaths(), ...buildV5Paths() },
  };
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function registerSwagger(app) {
  app.get("/swagger.json", (_req, res) => {
    res.json(buildOpenApiSpec());
  });

  app.get("/docs", (_req, res) => {
    const url = "/swagger.json";
    res.setHeader("content-type", "text/html; charset=utf-8");
    res.end(`<!DOCTYPE html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <title>Swagger - Escrilex API</title>
    <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
    <style>
      body { margin: 0; background: #fafafa; }
      #swagger-ui { max-width: 1400px; margin: 0 auto; }
    </style>
  </head>
  <body>
    <div id="swagger-ui"></div>
    <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
    <script>
      window.ui = SwaggerUIBundle({
        url: ${JSON.stringify(escapeHtml(url))},
        dom_id: '#swagger-ui',
        deepLinking: true,
        presets: [SwaggerUIBundle.presets.apis],
      });
    </script>
  </body>
</html>`);
  });
}
