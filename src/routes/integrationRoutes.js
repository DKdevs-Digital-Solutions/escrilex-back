import { Router } from "express";

export const integrationRoutes = Router();

// Basic CNPJ lookup (fills company registration data).
// Uses BrasilAPI: https://brasilapi.com.br/docs
integrationRoutes.get("/cnpj/:cnpj", async (req, res) => {
  const cnpj = (req.params.cnpj || "").replace(/\D/g, "");
  if (cnpj.length < 8) return res.status(400).json({ error: "invalid cnpj" });

  try {
    const r = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`);
    if (!r.ok) {
      const text = await r.text().catch(() => "");
      return res.status(r.status).json({ error: text || "cnpj lookup failed" });
    }
    const data = await r.json();
    // Keep only what the app needs
    res.json({
      cnpj: data.cnpj,
      razaoSocial: data.razao_social,
      nomeFantasia: data.nome_fantasia,
      logradouro: data.logradouro,
      numero: data.numero,
      municipio: data.municipio,
      uf: data.uf,
      cep: data.cep,
    });
  } catch (e) {
    console.error(e);
    res.status(502).json({ error: "cnpj lookup unavailable" });
  }
});
