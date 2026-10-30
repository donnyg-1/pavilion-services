"use client";

import { useState } from "react";
import { ActionForm, SubmitButton } from "@/components/admin-ui";
import { Field, Input, Select } from "@/components/ui";
import { saveCommunity } from "../../actions";

export function CommunityForm({ community, companies }: { community?: { id: string; name: string; city: string | null; managementCompanyId: string | null }; companies: { id: string; name: string }[] }) {
  const [company, setCompany] = useState(community?.managementCompanyId ?? "");
  return (
    <ActionForm action={saveCommunity.bind(null, community?.id ?? null)} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Community name" htmlFor="c-name">
          <Input id="c-name" name="name" defaultValue={community?.name} required placeholder="Sunset Ridge" />
        </Field>
        <Field label="City" htmlFor="c-city">
          <Input id="c-city" name="city" defaultValue={community?.city ?? ""} placeholder="Lehi" />
        </Field>
        <Field label="Management company" htmlFor="c-mgmt">
          <Select id="c-mgmt" name="managementCompanyId" value={company} onChange={(e) => setCompany(e.target.value)}>
            <option value="">None / self-managed</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
            <option value="__new">+ Add a new company</option>
          </Select>
        </Field>
        {company === "__new" ? (
          <Field label="New company name" htmlFor="c-newmgmt">
            <Input id="c-newmgmt" name="newManagementCompany" required />
          </Field>
        ) : null}
      </div>
      {company === "__new" ? <input type="hidden" name="managementCompanyId" value="" /> : null}
      <SubmitButton size="md">{community ? "Save" : "Add community"}</SubmitButton>
    </ActionForm>
  );
}
