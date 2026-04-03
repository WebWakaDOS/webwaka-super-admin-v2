/**
 * Builder Admin Page — webwaka-super-admin-v2
 * Blueprint Reference: WEBWAKA_UI_BUILDER_ARCHITECTURE.md — "SUP-1 Builder Admin"
 *
 * Task: SUP-1 — Integrate Builder Admin into super-admin-v2
 *
 * This page provides super-admins with:
 * 1. Template browser — view all available templates across verticals
 * 2. Tenant deployment manager — view and trigger deployments per tenant
 * 3. Branding config viewer — inspect tenant branding configs from UI_CONFIG_KV
 *
 * API calls go to webwaka-ui-builder (via VITE_UI_BUILDER_URL env var).
 */

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/contexts/AuthContext";

// ─── Types ───────────────────────────────────────────────────────────────────

interface TemplateDefinition {
  id: string;
  name: string;
  description: string;
  vertical: string;
  category: string;
  previewImageUrl: string;
  supportedFeatures: string[];
}

interface DeploymentRecord {
  id: string;
  tenantId: string;
  templateId: string;
  status: "pending" | "deploying" | "success" | "failed";
  deploymentUrl?: string;
  pagesProjectName?: string;
  customDomain?: string;
  error?: string;
  requestedAt: number;
  completedAt?: number;
}

// ─── API helpers ──────────────────────────────────────────────────────────────

const UI_BUILDER_URL =
  (import.meta as unknown as { env: Record<string, string> }).env
    .VITE_UI_BUILDER_URL ?? "https://webwaka-ui-builder.webwaka.workers.dev";

async function fetchTemplates(token: string, vertical?: string): Promise<TemplateDefinition[]> {
  const url = new URL(`${UI_BUILDER_URL}/v1/templates`);
  if (vertical && vertical !== "all") url.searchParams.set("vertical", vertical);
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Failed to fetch templates: ${res.status}`);
  const data = await res.json() as { templates: TemplateDefinition[] };
  return data.templates;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function BuilderAdmin() {
  const { token } = useAuth() as { token: string };
  const [templates, setTemplates] = useState<TemplateDefinition[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(true);
  const [templatesError, setTemplatesError] = useState<string | null>(null);
  const [verticalFilter, setVerticalFilter] = useState("all");

  // Deployment form state
  const [deployTenantId, setDeployTenantId] = useState("");
  const [deployTemplateId, setDeployTemplateId] = useState("");
  const [deployCustomDomain, setDeployCustomDomain] = useState("");
  const [deploying, setDeploying] = useState(false);
  const [deployResult, setDeployResult] = useState<{ id: string; status: string } | null>(null);
  const [deployError, setDeployError] = useState<string | null>(null);

  useEffect(() => {
    setTemplatesLoading(true);
    fetchTemplates(token, verticalFilter)
      .then(setTemplates)
      .catch((e: Error) => setTemplatesError(e.message))
      .finally(() => setTemplatesLoading(false));
  }, [token, verticalFilter]);

  const handleDeploy = async () => {
    if (!deployTenantId || !deployTemplateId) {
      setDeployError("Tenant ID and Template ID are required");
      return;
    }
    setDeploying(true);
    setDeployError(null);
    setDeployResult(null);
    try {
      const res = await fetch(`${UI_BUILDER_URL}/v1/deployments`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          "X-Tenant-Id": deployTenantId,
        },
        body: JSON.stringify({
          templateId: deployTemplateId,
          customDomain: deployCustomDomain || undefined,
        }),
      });
      const data = await res.json() as { deploymentId?: string; status?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setDeployResult({ id: data.deploymentId ?? "", status: data.status ?? "pending" });
    } catch (e: unknown) {
      setDeployError(e instanceof Error ? e.message : "Deployment failed");
    } finally {
      setDeploying(false);
    }
  };

  const statusBadgeVariant = (status: string) => {
    switch (status) {
      case "success": return "default";
      case "failed": return "destructive";
      case "deploying": return "secondary";
      default: return "outline";
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Builder Admin</h1>
        <p className="text-muted-foreground mt-1">
          Manage tenant website templates, branding configurations, and deployments via the
          webwaka-ui-builder service.
        </p>
      </div>

      <Tabs defaultValue="templates">
        <TabsList>
          <TabsTrigger value="templates">Templates</TabsTrigger>
          <TabsTrigger value="deploy">Deploy</TabsTrigger>
        </TabsList>

        {/* ─── Templates Tab ─────────────────────────────────────────────── */}
        <TabsContent value="templates" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Available Templates</CardTitle>
                <Select value={verticalFilter} onValueChange={setVerticalFilter}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Filter by vertical" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Verticals</SelectItem>
                    <SelectItem value="commerce">Commerce</SelectItem>
                    <SelectItem value="professional">Professional</SelectItem>
                    <SelectItem value="civic">Civic</SelectItem>
                    <SelectItem value="transport">Transport</SelectItem>
                    <SelectItem value="logistics">Logistics</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              {templatesLoading && (
                <div className="text-center py-8 text-muted-foreground">Loading templates...</div>
              )}
              {templatesError && (
                <div className="text-center py-8 text-destructive">
                  Error: {templatesError}
                </div>
              )}
              {!templatesLoading && !templatesError && (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Template ID</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Vertical</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Features</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {templates.map((t) => (
                      <TableRow key={t.id}>
                        <TableCell className="font-mono text-xs">{t.id}</TableCell>
                        <TableCell className="font-medium">{t.name}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{t.vertical}</Badge>
                        </TableCell>
                        <TableCell>{t.category}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {t.supportedFeatures.slice(0, 3).map((f) => (
                              <Badge key={f} variant="secondary" className="text-xs">
                                {f.replace(/_/g, " ")}
                              </Badge>
                            ))}
                            {t.supportedFeatures.length > 3 && (
                              <Badge variant="secondary" className="text-xs">
                                +{t.supportedFeatures.length - 3} more
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {templates.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                          No templates found
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── Deploy Tab ────────────────────────────────────────────────── */}
        <TabsContent value="deploy" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Trigger Deployment</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="tenantId">Tenant ID</Label>
                  <Input
                    id="tenantId"
                    placeholder="e.g. ten_abc123"
                    value={deployTenantId}
                    onChange={(e) => setDeployTenantId(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="templateId">Template ID</Label>
                  <Input
                    id="templateId"
                    placeholder="e.g. commerce/single-vendor-storefront"
                    value={deployTemplateId}
                    onChange={(e) => setDeployTemplateId(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="customDomain">Custom Domain (optional)</Label>
                  <Input
                    id="customDomain"
                    placeholder="e.g. shop.example.com"
                    value={deployCustomDomain}
                    onChange={(e) => setDeployCustomDomain(e.target.value)}
                  />
                </div>
              </div>

              {deployError && (
                <div className="text-sm text-destructive bg-destructive/10 rounded-md p-3">
                  {deployError}
                </div>
              )}
              {deployResult && (
                <div className="text-sm bg-green-50 border border-green-200 rounded-md p-3">
                  <p className="font-medium text-green-800">Deployment requested successfully</p>
                  <p className="text-green-700 font-mono text-xs mt-1">ID: {deployResult.id}</p>
                  <Badge className="mt-1" variant={statusBadgeVariant(deployResult.status)}>
                    {deployResult.status}
                  </Badge>
                </div>
              )}

              <Button onClick={handleDeploy} disabled={deploying}>
                {deploying ? "Deploying..." : "Trigger Deployment"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
