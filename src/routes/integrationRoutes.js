import { Router } from "express";

export const integrationRoutes = Router();

function normalizeCnpj(value) {
  return String(value ?? "").replace(/\D/g, "");
}

async function lookupCnpj(req, res) {
  // Aceita /cnpj/:cnpj, /cnpj/12.345.678/0001-90 sem encode e /cnpj?cnpj=...
  const rawCnpj = req.params.cnpj ?? req.params[0] ?? req.query.cnpj ?? "";
  const cnpj = normalizeCnpj(rawCnpj);

  if (cnpj.length !== 14) {
    return res.status(400).json({ error: "CNPJ inválido. Informe os 14 dígitos." });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const r = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`, { signal: controller.signal });

    if (!r.ok) {
      const text = await r.text().catch(() => "");
      return res.status(r.status).json({ error: text || "cnpj lookup failed" });
    }

    const data = await r.json();

    res.json({
      cnpj: data.cnpj ?? cnpj,
      razaoSocial: data.razao_social ?? null,
      nomeFantasia: data.nome_fantasia ?? null,
      logradouro: data.logradouro ?? null,
      numero: data.numero ?? null,
      municipio: data.municipio ?? null,
      uf: data.uf ?? null,
      cep: data.cep ?? null,
    });
  } catch (e) {
    console.error(e);
    res.status(502).json({ error: "cnpj lookup unavailable" });
  } finally {
    clearTimeout(timeout);
  }
}

// Basic CNPJ lookup (fills company registration data).
// Uses BrasilAPI: https://brasilapi.com.br/docs
integrationRoutes.get("/cnpj", lookupCnpj);
integrationRoutes.get("/cnpj/:cnpj", lookupCnpj);
integrationRoutes.get("/cnpj/*", lookupCnpj);
