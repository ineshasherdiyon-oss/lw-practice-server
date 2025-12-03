// ---------- Supabase health route ----------
app.get("/health", async (req, res) => {
  try {
    // ensure env vars exist
    const supabaseUrl = (process.env.SUPABASE_URL || "").replace(/\/$/, "");
    const serviceKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY; // fallback if named differently

    if (!supabaseUrl || !serviceKey) {
      return res.status(500).json({
        ok: false,
        error:
          "SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_KEY) is missing",
      });
    }

    // request the first row from the health_check table via Supabase REST
    const restUrl = `${supabaseUrl}/rest/v1/health_check?select=*&limit=1&order=id.desc`;
    const r = await fetch(restUrl, {
      method: "GET",
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        Accept: "application/json",
      },
    });

    const json = await r.json().catch(() => null);

    if (!r.ok) {
      return res.status(r.status).json({
        ok: false,
        error: json || `Supabase responded with status ${r.status}`,
      });
    }

    return res.json({
      ok: true,
      row: (Array.isArray(json) ? json[0] : json) || null,
    });
  } catch (err) {
    console.error("health route error:", err);
    return res
      .status(500)
      .json({ ok: false, error: err.message || String(err) });
  }
});
// --------------------------------------------
