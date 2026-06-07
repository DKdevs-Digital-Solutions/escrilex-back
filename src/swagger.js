
function buildV5Paths() {
  const authRequired = [{ bearerAuth: [] }];
  return {
    "/api/expectation-matrix/options": {
      get: {
        tags: ["Matriz de Expectativas"],
        summary: "Metadados, colunas dinâmicas, opções e usuários da Matriz de Expectativas",
        description: [
          "Retorna as colunas da tabela, incluindo **colunas dinâmicas de responsável por setor**.",
          "Cada setor ativo gera uma coluna com `type: 'sector-user'`, `key = sector.name` e `label = 'RESP. <NOME>'`.",
          "O campo `setores` lista os setores ativos com id e name.",
          "O campo `users` lista os usuários ativos para popular os selects.",
        ].join(" "),
        security: authRequired,
        responses: {
          200: {
            description: "Opções retornadas",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    columns: {
                      type: "array",
                      description: "Colunas estáticas + colunas dinâmicas de setor (type: sector-user)",
                      items: {
                        type: "object",
                        properties: {
                          key:      { type: "string" },
                          label:    { type: "string" },
                          type:     { type: "string", enum: ["automatic", "text", "textarea", "select", "date", "sector-user"] },
                          sectorId: { type: "string", description: "Presente apenas em colunas sector-user" },
                        },
                      },
                    },
                    options:  { type: "object", description: "Opções de cada campo select" },
                    users:    { type: "array",  description: "Usuários ativos para selects de responsável" },
                    setores:  { type: "array",  description: "Setores ativos", items: { type: "object", properties: { id: { type: "string" }, name: { type: "string" } } } },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/api/expectation-matrix": {
      get: {
        tags: ["Matriz de Expectativas"],
        summary: "Listar a Matriz de Expectativas em formato de tabela",
        description: [
          "Cada item inclui as colunas estáticas da empresa + colunas dinâmicas de setor.",
          "As colunas dinâmicas têm como **chave o nome do setor** e **valor o e-mail do responsável** (ou null se não atribuído).",
          "Exemplo: `{ ..., 'Fiscal': 'fulano@email.com', 'Contábil': null }`.",
        ].join(" "),
        security: authRequired,
        parameters: [
          { name: "search",    in: "query", schema: { type: "string"  } },
          { name: "status",    in: "query", schema: { type: "string"  } },
          { name: "grupo",     in: "query", schema: { type: "string"  } },
          { name: "tributacao",in: "query", schema: { type: "string"  } },
          { name: "ramo",      in: "query", schema: { type: "string"  } },
          { name: "perfil",    in: "query", schema: { type: "string"  } },
          { name: "active",    in: "query", schema: { type: "boolean" }, description: "Filtrar por situação ativa/inativa" },
          { name: "limit",     in: "query", schema: { type: "integer", default: 100, maximum: 500 } },
          { name: "offset",    in: "query", schema: { type: "integer", default: 0 } },
        ],
        responses: {
          200: {
            description: "Linhas retornadas",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    total:  { type: "integer" },
                    limit:  { type: "integer" },
                    offset: { type: "integer" },
                    items:  { type: "array", items: { type: "object", description: "Campos fixos + chaves dinâmicas por nome do setor com e-mail do responsável" } },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/api/expectation-matrix/{companyId}": {
      get: {
        tags: ["Matriz de Expectativas"],
        summary: "Detalhar linha da Matriz de Expectativas por empresa",
        description: "Retorna os dados fixos da empresa + colunas dinâmicas de setor (chave = nome do setor, valor = e-mail do responsável ou null).",
        security: authRequired,
        parameters: [{ name: "companyId", in: "path", required: true, schema: { type: "string" } }],
        responses: { 200: { description: "Linha retornada" }, 404: { description: "Empresa não encontrada" } },
      },
      put: {
        tags: ["Matriz de Expectativas"],
        summary: "Editar dados da Matriz de Expectativas",
        description: [
          "Atualiza campos da matriz e/ou responsáveis por setor.",
          "Para atribuir responsáveis use o campo **`responsaveis`**: objeto com `{ 'Nome do Setor': 'userId' | null }`.",
          "`null` remove a atribuição do setor.",
          "Ao mudar o status para **'Bloqueado'** pela primeira vez, os campos `statusBloqueadoAt` e `statusBloqueadoByUserId` são registrados automaticamente.",
          "Status **'Encerrado'** exige informar as datas de saída/fim de cobrança por departamento e o motivo da saída.",
        ].join(" "),
        security: authRequired,
        parameters: [{ name: "companyId", in: "path", required: true, schema: { type: "string" } }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  status:      { type: "string", enum: ["Em Implantação", "Pendente de Documentação", "Ativo", "Sem atividade", "Sem Movimento", "Baixada", "Em Saída", "Encerrado", "Bloqueado", "Doméstica"] },
                  observacoes: { type: "string", nullable: true },
                  responsaveis: {
                    type: "object",
                    description: "Atribuição de responsáveis por setor. Chave = nome do setor, valor = userId (string) ou null para remover.",
                    example: { "Fiscal": "user-id-abc", "Contábil": "user-id-xyz", "RH": null },
                    additionalProperties: { type: "string", nullable: true },
                  },
                },
              },
            },
          },
        },
        responses: { 200: { description: "Linha atualizada" }, 400: { description: "Validação falhou ou campos obrigatórios faltando para Encerrado" }, 404: { description: "Empresa não encontrada" } },
      },
      patch: {
        tags: ["Matriz de Expectativas"],
        summary: "Editar parcialmente dados da Matriz de Expectativas (alias de PUT)",
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
          { name: "endDate",   in: "query", schema: { type: "string", format: "date-time" } },
        ],
        responses: { 200: { description: "Resumo retornado" } },
      },
    },
    "/api/dashboard/analytics": {
      get: {
        tags: ["Dashboard"],
        summary: "Análise de permanência, motivos de saída e cancelamentos",
        description: [
          "Retorna três blocos de dados para o período informado:",
          "**permanencia** — lista de empresas que saíram no período com `diasPermanencia` calculado (dataEntrada → dataSaida) e `mediaDias` geral.",
          "**motivosSaida** — agrupamento por `motivoSaidaResumo` com `quantidade` e `percentual` de cada motivo.",
          "**cancelamentos** — `quantidade` de saídas no período, `totalEmpresas` cadastradas até o fim do período e `percentual`.",
          "Padrão do período: últimos 7 dias (igual ao /summary).",
        ].join(" "),
        security: authRequired,
        parameters: [
          { name: "startDate", in: "query", schema: { type: "string", format: "date-time" }, description: "Início do período (padrão: 7 dias atrás)" },
          { name: "endDate",   in: "query", schema: { type: "string", format: "date-time" }, description: "Fim do período (padrão: hoje)" },
        ],
        responses: {
          200: {
            description: "Analytics retornados",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    period: {
                      type: "object",
                      properties: {
                        startDate: { type: "string", format: "date-time" },
                        endDate:   { type: "string", format: "date-time" },
                      },
                    },
                    permanencia: {
                      type: "object",
                      properties: {
                        mediaDias: { type: "integer", nullable: true, description: "Média de dias de permanência das empresas que saíram no período" },
                        empresas: {
                          type: "array",
                          items: {
                            type: "object",
                            properties: {
                              id:              { type: "string" },
                              cnpj:            { type: "string" },
                              razaoSocial:     { type: "string", nullable: true },
                              nomeFantasia:    { type: "string", nullable: true },
                              dataEntrada:     { type: "string", format: "date-time", nullable: true },
                              dataSaida:       { type: "string", format: "date-time", nullable: true },
                              diasPermanencia: { type: "integer", nullable: true },
                              motivoSaida:     { type: "string", nullable: true },
                              status:          { type: "string", nullable: true },
                            },
                          },
                        },
                      },
                    },
                    motivosSaida: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          motivo:     { type: "string" },
                          quantidade: { type: "integer" },
                          percentual: { type: "number", description: "% em relação ao total de saídas do período" },
                        },
                      },
                    },
                    cancelamentos: {
                      type: "object",
                      properties: {
                        quantidade:    { type: "integer", description: "Empresas que saíram no período" },
                        totalEmpresas: { type: "integer", description: "Total de empresas cadastradas até o fim do período" },
                        percentual:    { type: "number",  description: "quantidade / totalEmpresas × 100" },
                      },
                    },
                  },
                },
              },
            },
          },
          400: { description: "Parâmetro de data inválido" },
        },
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
        description: [
          "Retorna todos os eventos de auditoria com campos enriquecidos.",
          "Cada item inclui: **nomeEmpresa** (resolvido do banco), **usuarioResponsavel** (id/name/email),",
          "**data** (YYYY-MM-DD), **hora** (HH:MM:SS), **camposAlterados** (diff campo a campo entre valorAnterior e novoValor).",
          "Use `companyId` como atalho para filtrar todos os logs de uma empresa específica.",
        ].join(" "),
        security: adminRequired,
        parameters: [
          { name: "companyId", in: "query", schema: { type: "string" }, description: "Atalho: filtra todos os logs da empresa (entity=Company + entityId=companyId)" },
          { name: "entity",    in: "query", schema: { type: "string" }, description: "Filtrar por entidade (ex: Company, User, Sector)" },
          { name: "entityId",  in: "query", schema: { type: "string" }, description: "Filtrar por ID da entidade" },
          { name: "action",    in: "query", schema: { type: "string" }, description: "Filtrar por ação (busca parcial, case-insensitive)" },
          { name: "startDate", in: "query", schema: { type: "string", format: "date-time" }, description: "Início do período" },
          { name: "endDate",   in: "query", schema: { type: "string", format: "date-time" }, description: "Fim do período" },
          { name: "limit",     in: "query", schema: { type: "integer", default: 50, maximum: 200 } },
          { name: "offset",    in: "query", schema: { type: "integer", default: 0 } },
        ],
        responses: {
          200: {
            description: "Eventos de auditoria enriquecidos",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    limit:  { type: "integer" },
                    offset: { type: "integer" },
                    items: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          id:               { type: "string" },
                          data:             { type: "string", example: "2026-06-07", description: "Data do evento (YYYY-MM-DD)" },
                          hora:             { type: "string", example: "14:32:10",   description: "Hora do evento (HH:MM:SS)" },
                          nomeEmpresa:      { type: "string", nullable: true, description: "Razão social da empresa (quando entity=Company)" },
                          usuarioResponsavel: {
                            type: "object",
                            description: "Usuário que realizou a alteração",
                            properties: {
                              id:    { type: "string" },
                              name:  { type: "string" },
                              email: { type: "string" },
                            },
                          },
                          action:    { type: "string" },
                          entity:    { type: "string" },
                          entityId:  { type: "string", nullable: true },
                          camposAlterados: {
                            type: "array",
                            description: "Diff campo a campo entre valorAnterior e novoValor",
                            items: {
                              type: "object",
                              properties: {
                                campo:         { type: "string" },
                                valorAnterior: { description: "Valor antes da alteração" },
                                novoValor:     { description: "Valor após a alteração" },
                              },
                            },
                          },
                          valorAnterior: { description: "Snapshot completo antes da alteração (JSON)" },
                          novoValor:     { description: "Snapshot completo após a alteração (JSON)" },
                          ip:        { type: "string", nullable: true },
                          userAgent: { type: "string", nullable: true },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
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
        description: "Ao enviar `situacao: 'Bloqueado'` pela primeira vez, os campos `bloqueadoAt` (data/hora) e `bloqueadoPor` (userId) são registrados automaticamente.",
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
