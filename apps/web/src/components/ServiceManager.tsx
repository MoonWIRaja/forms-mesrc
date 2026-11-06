"use client";

import { useCallback, useEffect, useState } from "react";
import type { ServiceRow } from "@/lib/form-types";
import { getSupabase } from "@/lib/supabase";

export default function ServiceManager() {
  const [services, setServices] = useState<ServiceRow[]>([]);
  const [name, setName] = useState("");
  const [sortOrder, setSortOrder] = useState(10);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadServices = useCallback(async () => {
    const supabase = getSupabase();
    const { data } = await supabase
      .from("services")
      .select("id,name,is_active,sort_order")
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });
    setServices((data as ServiceRow[] | null) ?? []);
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      const supabase = getSupabase();
      const { data } = await supabase
        .from("services")
        .select("id,name,is_active,sort_order")
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true });
      if (active) setServices((data as ServiceRow[] | null) ?? []);
    })();
    return () => {
      active = false;
    };
  }, []);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const supabase = getSupabase();
      const { error: insErr } = await supabase.from("services").insert({
        name: name.trim(),
        sort_order: sortOrder,
        is_active: true,
      });
      if (insErr) throw insErr;
      setName("");
      await loadServices();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add service.");
    } finally {
      setBusy(false);
    }
  }

  async function handleToggle(svc: ServiceRow) {
    setBusy(true);
    setError(null);
    try {
      const supabase = getSupabase();
      const { error: upErr } = await supabase
        .from("services")
        .update({ is_active: !svc.is_active })
        .eq("id", svc.id);
      if (upErr) throw upErr;
      await loadServices();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update service.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stack">
      <h2>Company Services &amp; Operations</h2>
      <p className="notice">
        Organize forms, submissions, and complaint tickets by company service/operation. Service
        tags help filter and report without silently hiding published forms from invited Users.
      </p>

      {error && (
        <p className="alert alert-error" role="alert">
          {error}
        </p>
      )}

      <form onSubmit={handleAdd} className="grid-2">
        <div className="field">
          <label htmlFor="svc-name">Service / Operation Name</label>
          <input
            id="svc-name"
            type="text"
            required
            placeholder="e.g. Human Resources, Fleet Operations"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="svc-order">Sort Order</label>
          <div className="row-actions">
            <input
              id="svc-order"
              type="number"
              value={sortOrder}
              onChange={(e) => setSortOrder(Number(e.target.value) || 0)}
              style={{ maxWidth: "110px" }}
            />
            <button type="submit" className="btn btn-primary" disabled={busy}>
              {busy ? "Adding..." : "Add Service"}
            </button>
          </div>
        </div>
      </form>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Service Name</th>
              <th>Sort Order</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {services.length === 0 ? (
              <tr>
                <td colSpan={4} className="notice">
                  No services configured yet.
                </td>
              </tr>
            ) : (
              services.map((svc) => (
                <tr key={svc.id}>
                  <td>{svc.name}</td>
                  <td>{svc.sort_order}</td>
                  <td>
                    <span
                      className={`badge ${svc.is_active ? "badge-configured" : "badge-not_configured"}`}
                    >
                      {svc.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td>
                    <button
                      type="button"
                      className="btn-link"
                      disabled={busy}
                      onClick={() => handleToggle(svc)}
                    >
                      {svc.is_active ? "Deactivate" : "Activate"}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}