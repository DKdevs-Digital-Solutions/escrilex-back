function buildPaths() {
  const authRequired = [{ bearerAuth: [] }];

const clientContactSchema = {
  type: "object",
  required: ["area"],
  properties: {
    area: { type: "string", enum: ["Folha", "Fiscal", "Contábil", "Financeiro"] },
    nome: { type: "string" },
    email: { type: "string", format: "email", description: "Compatibilidade: e-mail principal/primeiro e-mail." },
    emails: { type: "array", items: { type: "string", format: "email" }, example: ["folha@cliente.com.br", "rh@cliente.com.br"] },
  },
};

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
        description: "Indicadores gerenciais do SGE: entradas, saídas, alterações, tributação, ramo, perfil e responsáveis. Aceita period=7d, 30d, 365d ou período personalizado.",
        security: authRequired,
        parameters: [
          { name: "period", in: "query", schema: { type: "string", enum: ["7d", "30d", "365d"] } },
          { name: "startDate", in: "query", schema: { type: "string", format: "date-time" } },
          { name: "endDate", in: "query", schema: { type: "string", format: "date-time" } },
        ],
        responses: { 200: { description: "Resumo retornado" } },
      },
    },
    "/api/dashboard/drilldown": {
      get: {
        tags: ["Dashboard"],
        summary: "Detalhamento dos indicadores do dashboard",
        security: authRequired,
        parameters: [
          { name: "type", in: "query", required: true, schema: { type: "string", enum: ["entries", "exits", "tributacao", "ramo", "perfil", "responsibles", "changes"] } },
          { name: "key", in: "query", schema: { type: "string" } },
          { name: "period", in: "query", schema: { type: "string", enum: ["7d", "30d", "365d"] } },
          { name: "startDate", in: "query", schema: { type: "string", format: "date-time" } },
          { name: "endDate", in: "query", schema: { type: "string", format: "date-time" } },
        ],
        responses: { 200: { description: "Itens detalhados" } },
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
          { name: "search", in: "query", schema: { type: "string", description: "Busca por código, razão social, CNPJ ou grupo" } },
          { name: "status", in: "query", schema: { type: "string" } },
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
    "/api/companies/export": {
      get: {
        tags: ["Empresas"],
        summary: "Exportar empresas em Excel ou CSV",
        security: authRequired,
        parameters: [
          { name: "format", in: "query", schema: { type: "string", enum: ["xlsx", "csv"] } },
          { name: "search", in: "query", schema: { type: "string" } },
          { name: "status", in: "query", schema: { type: "string" } },
        ],
        responses: { 200: { description: "Arquivo exportado" } },
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
      put: {
        tags: ["Empresas"],
        summary: "Definir responsáveis por setor",
        security: authRequired,
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        requestBody: { required: true, content: { "application/json": { schema: { type: "object" } } } },
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
    "/api/companies/{id}/client-contacts": {
      get: { tags: ["Empresas - Responsáveis do Cliente"], summary: "Listar responsáveis internos no cliente", security: authRequired, parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { 200: { description: "Responsáveis internos" } } },
      post: { tags: ["Empresas - Responsáveis do Cliente"], summary: "Cadastrar responsável interno no cliente", description: "Aceita múltiplos e-mails no campo emails. O campo email continua aceito como compatibilidade e será tratado como e-mail principal.", security: authRequired, parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], requestBody: { required: true, content: { "application/json": { schema: clientContactSchema, examples: { multiploEmails: { value: { area: "Fiscal", nome: "Responsável Fiscal", emails: ["fiscal@cliente.com.br", "contabilidade@cliente.com.br"] } }, legadoEmailUnico: { value: { area: "Folha", nome: "Responsável RH", email: "rh@cliente.com.br" } } } } } }, responses: { 201: { description: "Responsável criado" } } },
    },
    "/api/companies/{id}/client-contacts/{contactId}": {
      put: { tags: ["Empresas - Responsáveis do Cliente"], summary: "Editar responsável interno no cliente", description: "Permite atualizar nome, área, email principal e lista emails com múltiplos endereços.", security: authRequired, parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }, { name: "contactId", in: "path", required: true, schema: { type: "string" } }], requestBody: { required: true, content: { "application/json": { schema: { ...clientContactSchema, required: [] }, examples: { atualizarEmails: { value: { emails: ["financeiro@cliente.com.br", "cobranca@cliente.com.br"] } } } } } }, responses: { 200: { description: "Responsável atualizado" } } },
      delete: { tags: ["Empresas - Responsáveis do Cliente"], summary: "Excluir responsável interno no cliente", security: authRequired, parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }, { name: "contactId", in: "path", required: true, schema: { type: "string" } }], responses: { 200: { description: "Responsável removido" } } },
    },
    "/api/companies/{id}/access-credentials": {
      get: { tags: ["Empresas - Acessos"], summary: "Listar acessos da empresa", security: authRequired, parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { 200: { description: "Acessos" } } },
      put: { tags: ["Empresas - Acessos"], summary: "Salvar acessos da empresa", security: authRequired, parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["credentials"], properties: { credentials: { type: "array", items: { type: "object", required: ["service"], properties: { service: { type: "string", enum: ["Prefeitura", "Sefaz"] }, login: { type: "string" }, password: { type: "string" } } } } } } } } }, responses: { 200: { description: "Acessos salvos" } } },
    },
    "/api/companies/{id}/history": {
      get: { tags: ["Empresas - Histórico"], summary: "Histórico/auditoria da empresa", security: authRequired, parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], responses: { 200: { description: "Histórico retornado" } } },
    },
    "/api/integrations/cnpj/{cnpj}": {
      get: {
        tags: ["Integrações"],
        summary: "Consultar atendentes por CNPJ e setor",
        description: "Retorna attendants por setor no formato usado pela integração/Blip. Cada item possui o nome do setor e a lista de e-mails dos responsáveis daquele setor.",
        security: authRequired,
        parameters: [{ name: "cnpj", in: "path", required: true, schema: { type: "string" } }],
        responses: {
          200: {
            description: "Atendentes responsáveis por setor encontrados para o CNPJ",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    attendants: {
                      type: "array",
                      description: "Lista por setor, contendo apenas os e-mails dos responsáveis.",
                      items: {
                        type: "object",
                        properties: {
                          sector: { type: "string", example: "Fiscal" },
                          responsibles: {
                            type: "array",
                            items: { type: "string", format: "email" },
                            example: ["ana@empresa.com", "mario@empresa.com"],
                          },
                        },
                      },
                    },
                    clientContacts: { type: "array", items: clientContactSchema },
                  },
                },
                example: {
                  attendants: [
                    { sector: "Fiscal", responsibles: ["ana@empresa.com", "mario@empresa.com"] },
                    { sector: "Compliance", responsibles: ["ana@empresa.com", "mario@empresa.com"] },
                  ],
                  clientContacts: [{ id: "resp_1", area: "Fiscal", nome: "Responsável Fiscal", email: "fiscal@cliente.com.br", emails: ["fiscal@cliente.com.br", "contabilidade@cliente.com.br"] }],
                },
              },
            },
          },
        },
      },
    },
    "/api/templates": {
      get: {
        tags: ["Processos"],
        summary: "Listar processos",
        security: authRequired,
        responses: { 200: { description: "Lista de templates" } },
      },
      post: {
        tags: ["Processos"],
        summary: "Criar processo",
        security: authRequired,
        requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["type", "name"], properties: { type: { type: "string", enum: ["ENTRADA", "SAIDA"] }, name: { type: "string" } } } } } },
        responses: { 201: { description: "Template criado" } },
      },
    },
    "/api/templates/default/by-type/{type}": {
      get: {
        tags: ["Processos"],
        summary: "Processo padrão por tipo",
        security: authRequired,
        parameters: [{ name: "type", in: "path", required: true, schema: { type: "string", enum: ["ENTRADA", "SAIDA"] } }],
        responses: { 200: { description: "Template padrão" } },
      },
    },
    "/api/templates/{id}": {
      get: {
        tags: ["Processos"],
        summary: "Detalhar processo",
        security: authRequired,
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { 200: { description: "Template detalhado" } },
      },
      put: {
        tags: ["Processos"],
        summary: "Editar processo",
        security: authRequired,
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        requestBody: { required: true, content: { "application/json": { schema: { type: "object" } } } },
        responses: { 200: { description: "Template atualizado" } },
      },
    },
    "/api/templates/{id}/sections": {
      post: {
        tags: ["Processos - Seções"],
        summary: "Criar seção",
        security: authRequired,
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        requestBody: { required: true, content: { "application/json": { schema: { type: "object", required: ["name"], properties: { name: { type: "string" }, order: { type: "integer" } } } } } },
        responses: { 201: { description: "Seção criada" } },
      },
    },
    "/api/templates/sections/{sectionId}": {
      put: {
        tags: ["Processos - Seções"],
        summary: "Editar seção",
        security: authRequired,
        parameters: [{ name: "sectionId", in: "path", required: true, schema: { type: "string" } }],
        requestBody: { required: true, content: { "application/json": { schema: { type: "object" } } } },
        responses: { 200: { description: "Seção atualizada" } },
      },
      delete: {
        tags: ["Processos - Seções"],
        summary: "Excluir seção",
        security: authRequired,
        parameters: [{ name: "sectionId", in: "path", required: true, schema: { type: "string" } }],
        responses: { 200: { description: "Seção removida" } },
      },
    },
    "/api/templates/{id}/items": {
      post: {
        tags: ["Processos - Itens"],
        summary: "Criar item",
        security: authRequired,
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        requestBody: { required: true, content: { "application/json": { schema: { type: "object" } } } },
        responses: { 201: { description: "Item criado" } },
      },
    },
    "/api/templates/items/{itemId}": {
      put: {
        tags: ["Processos - Itens"],
        summary: "Editar item",
        security: authRequired,
        parameters: [{ name: "itemId", in: "path", required: true, schema: { type: "string" } }],
        requestBody: { required: true, content: { "application/json": { schema: { type: "object" } } } },
        responses: { 200: { description: "Item atualizado" } },
      },
      delete: {
        tags: ["Processos - Itens"],
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
    paths: buildPaths(),
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
