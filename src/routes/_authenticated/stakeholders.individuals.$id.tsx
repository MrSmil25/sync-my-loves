import { useRef, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import {
  Archive,
  ArchiveRestore,
  CreditCard,
  Instagram,
  Linkedin,
  Mail,
  MessageCircle,
  MoreHorizontal,
  Pencil,
  Phone,
  Plus,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { isBPH, isSupervisor, useDivisions, useMyProfile, useProfiles } from "@/hooks/useProfile";
import {
  ROLE_META,
  avatarColor,
  deleteAffiliation,
  expertiseChips,
  fetchAffiliations,
  fetchIndividual,
  instagramLink,
  nameInitials,
  setIndividualArchived,
  uploadBusinessCard,
  waLink,
} from "@/lib/stakeholders";
import { supabase } from "@/lib/supabase-external";
import {
  fetchIndividualInteractions,
  fetchIndividualStatus,
} from "@/lib/interactions";
import { RelationshipBadge } from "@/components/stakeholders/RelationshipBadge";
import { LogInteractionButton } from "@/components/stakeholders/LogInteractionButton";
import { InteractionTimeline } from "@/components/stakeholders/InteractionTimeline";
import { IndividualEditDialog } from "@/components/stakeholders/IndividualEditDialog";
import { AffiliationFormDialog } from "@/components/stakeholders/AffiliationFormDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/_authenticated/stakeholders/individuals/$id")({
  validateSearch: (search: Record<string, unknown>): { log?: boolean | undefined } => ({
    log: search["log"] === "1" || search["log"] === true ? true : undefined,
  }),
  head: () => ({
    meta: [{ title: "Detail Individual — Pemangku Kepentingan" }],
  }),
  component: IndividualDetailPage,
  notFoundComponent: () => (
    <div className="py-16 text-center text-sm text-muted-foreground">Individual tidak ditemukan.</div>
  ),
});

function IndividualDetailPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [affOpen, setAffOpen] = useState(false);
  const [cardFull, setCardFull] = useState(false);
  const [uploading, setUploading] = useState(false);

  const { data: profile } = useMyProfile();
  const { data: profiles = [] } = useProfiles();
  const { data: divisions = [] } = useDivisions();
  const { data: individual, isLoading } = useQuery({
    queryKey: ["individual", id],
    queryFn: () => fetchIndividual(id),
  });
  const { data: affiliations = [] } = useQuery({
    queryKey: ["affiliations", id],
    queryFn: () => fetchAffiliations(id),
  });
  const { log: autoLog } = Route.useSearch();
  const { data: relStatus } = useQuery({
    queryKey: ["relationship-status", "individual", id],
    queryFn: () => fetchIndividualStatus(id),
  });
  const { data: interactions = [] } = useQuery({
    queryKey: ["interactions", "individual", id],
    queryFn: () => fetchIndividualInteractions(id),
  });


  if (isLoading) {
    return <div className="py-16 text-center text-sm text-muted-foreground">Memuat…</div>;
  }
  if (!individual) {
    return <div className="py-16 text-center text-sm text-muted-foreground">Individual tidak ditemukan.</div>;
  }

  const meta = ROLE_META[individual.primary_role];
  const introducer = profiles.find((p) => p.id === individual.introduced_by);
  const divisionName = divisions.find((d) => d.code === individual.owner_division)?.name;
  const ownerPerson = profiles.find((p) => p.id === individual.owner_person_id);
  const canManage =
    !!profile &&
    (isBPH(profile.role) ||
      isSupervisor(profile.role) ||
      profile.role === "Kadiv" ||
      individual.owner_person_id === profile.id ||
      individual.created_by === profile.id);

  const wa = waLink(individual.whatsapp_number);
  const ig = instagramLink(individual.instagram_handle);

  async function toggleArchive() {
    try {
      await setIndividualArchived(individual!.id, !individual!.is_archived);
      queryClient.invalidateQueries({ queryKey: ["individuals"] });
      queryClient.invalidateQueries({ queryKey: ["individual", id] });
      toast.success(individual!.is_archived ? "Dikeluarkan dari arsip." : "Diarsipkan.");
      if (!individual!.is_archived) navigate({ to: "/stakeholders/individuals" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal mengubah arsip.");
    }
  }

  async function onCardUpload(file: File | null) {
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadBusinessCard(file);
      const { error } = await supabase
        .from("individuals")
        .update({ business_card_url: url, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["individual", id] });
      toast.success("Kartu nama diperbarui.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal mengunggah kartu nama.");
    } finally {
      setUploading(false);
    }
  }

  async function removeAffiliation(affId: string) {
    try {
      await deleteAffiliation(affId);
      queryClient.invalidateQueries({ queryKey: ["affiliations", id] });
      queryClient.invalidateQueries({ queryKey: ["individuals"] });
      toast.success("Afiliasi dihapus.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Gagal menghapus afiliasi.");
    }
  }

  return (
    <div className="space-y-6">
      <Link to="/stakeholders/individuals" className="text-sm text-muted-foreground hover:text-foreground">
        ← Kembali ke Individuals
      </Link>

      <Card>
        <CardContent className="flex flex-wrap items-start gap-5 pt-6">
          {individual.photo_url ? (
            <img
              src={individual.photo_url}
              alt={individual.full_name}
              className="size-[120px] rounded-2xl object-cover"
            />
          ) : (
            <span
              className={`flex size-[120px] items-center justify-center rounded-2xl text-3xl font-bold ${avatarColor(individual.full_name)}`}
            >
              {nameInitials(individual.full_name)}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-bold tracking-tight">
              {individual.full_name}
              {individual.nickname && (
                <span className="ml-2 text-base font-normal text-muted-foreground">({individual.nickname})</span>
              )}
            </h1>
            {individual.title && <p className="mt-0.5 text-sm text-muted-foreground">{individual.title}</p>}
            <div className="mt-2 flex items-center gap-2">
              <Badge variant="outline" className={meta?.badge ?? ""}>
                {meta?.label ?? individual.primary_role}
              </Badge>
              {individual.is_archived && <Badge variant="secondary">Diarsipkan</Badge>}
              <RelationshipBadge status={relStatus} />
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {individual.email && (
                <Button size="sm" variant="outline" asChild>
                  <a href={`mailto:${individual.email}`}><Mail className="size-4" /> Email</a>
                </Button>
              )}
              {individual.phone && (
                <Button size="sm" variant="outline" asChild>
                  <a href={`tel:${individual.phone}`}><Phone className="size-4" /> Telepon</a>
                </Button>
              )}
              {wa && (
                <Button size="sm" variant="outline" asChild>
                  <a href={wa} target="_blank" rel="noreferrer"><MessageCircle className="size-4" /> WhatsApp</a>
                </Button>
              )}
              {individual.linkedin_url && (
                <Button size="sm" variant="outline" asChild>
                  <a href={individual.linkedin_url} target="_blank" rel="noreferrer"><Linkedin className="size-4" /> LinkedIn</a>
                </Button>
              )}
              {ig && (
                <Button size="sm" variant="outline" asChild>
                  <a href={ig} target="_blank" rel="noreferrer"><Instagram className="size-4" /> Instagram</a>
                </Button>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <LogInteractionButton
              target={{ kind: "individual", id: individual.id, name: individual.full_name }}
              autoOpen={!!autoLog}
            />
            <Button variant="outline" onClick={() => setEditOpen(true)}>
              <Pencil className="size-4" /> Edit
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="icon" variant="ghost" aria-label="Aksi lainnya">
                  <MoreHorizontal className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={toggleArchive}>
                  {individual.is_archived ? (
                    <><ArchiveRestore className="size-4" /> Keluarkan dari Arsip</>
                  ) : (
                    <><Archive className="size-4" /> Arsipkan</>
                  )}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="tentang">
        <TabsList>
          <TabsTrigger value="tentang">Tentang</TabsTrigger>
          <TabsTrigger value="afiliasi">Afiliasi</TabsTrigger>
          <TabsTrigger value="kartu">Kartu Nama</TabsTrigger>
          <TabsTrigger value="riwayat">Riwayat</TabsTrigger>
        </TabsList>

        <TabsContent value="tentang" className="mt-4 space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Catatan Strategis</CardTitle></CardHeader>
            <CardContent className="text-sm">
              {individual.strategic_notes || <span className="text-muted-foreground">Belum ada catatan.</span>}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Bidang Keahlian & Tag</CardTitle></CardHeader>
            <CardContent className="flex flex-wrap gap-1.5">
              {expertiseChips(individual.areas_of_expertise).map((e) => (
                <Badge key={e} variant="secondary">{e}</Badge>
              ))}
              {(individual.tags ?? []).map((t) => (
                <Badge key={t} variant="outline">#{t}</Badge>
              ))}
              {expertiseChips(individual.areas_of_expertise).length === 0 &&
                (individual.tags ?? []).length === 0 && (
                  <span className="text-sm text-muted-foreground">Belum ada.</span>
                )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Owner</CardTitle></CardHeader>
            <CardContent className="text-sm">
              <p>Divisi: <span className="font-medium">{divisionName ?? individual.owner_division ?? "—"}</span></p>
              <p className="mt-1">PIC: <span className="font-medium">{ownerPerson?.full_name ?? "Belum ada"}</span></p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Konteks Pengenalan</CardTitle></CardHeader>
            <CardContent className="space-y-1 text-sm">
              <p>
                Tanggal kenal:{" "}
                <span className="font-medium">
                  {individual.first_met_date
                    ? format(new Date(individual.first_met_date), "d MMMM yyyy", { locale: localeId })
                    : "—"}
                </span>
              </p>
              {individual.first_met_context && <p>{individual.first_met_context}</p>}
              {introducer && (
                <p className="text-muted-foreground">Diperkenalkan oleh {introducer.full_name}</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="afiliasi" className="mt-4 space-y-3">
          {canManage && (
            <Button onClick={() => setAffOpen(true)}>
              <Plus className="size-4" /> Tambah Afiliasi
            </Button>
          )}
          {affiliations.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                Belum ada afiliasi tercatat.
              </CardContent>
            </Card>
          ) : (
            affiliations.map((a) => (
              <Card key={a.id}>
                <CardContent className="flex flex-wrap items-center gap-3 py-4">
                  <div className="min-w-0 flex-1">
                    {a.company ? (
                      <Link
                        to="/companies/$id"
                        params={{ id: a.company.id }}
                        className="font-medium hover:underline"
                      >
                        {a.company.name}
                      </Link>
                    ) : (
                      <span className="font-medium">—</span>
                    )}
                    <p className="text-xs text-muted-foreground">
                      {a.role_at_company ?? "Peran tidak dicatat"}
                      {" · "}
                      {a.start_date
                        ? format(new Date(a.start_date), "MMM yyyy", { locale: localeId })
                        : "?"}
                      {" – "}
                      {a.end_date
                        ? format(new Date(a.end_date), "MMM yyyy", { locale: localeId })
                        : "sekarang"}
                    </p>
                  </div>
                  {a.is_primary && <Badge>Primer</Badge>}
                  {canManage && (
                    <Button size="sm" variant="ghost" onClick={() => removeAffiliation(a.id)}>
                      Hapus
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="kartu" className="mt-4 space-y-3">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => onCardUpload(e.target.files?.[0] ?? null)}
          />
          {individual.business_card_url ? (
            <>
              <button type="button" onClick={() => setCardFull(true)} className="block">
                <img
                  src={individual.business_card_url}
                  alt={`Kartu nama ${individual.full_name}`}
                  className="max-h-80 rounded-2xl border object-contain"
                />
              </button>
              <Button variant="outline" disabled={uploading} onClick={() => fileRef.current?.click()}>
                <Upload className="size-4" /> {uploading ? "Mengunggah…" : "Ganti / Upload Ulang"}
              </Button>
              <Dialog open={cardFull} onOpenChange={setCardFull}>
                <DialogContent className="max-w-4xl">
                  <img
                    src={individual.business_card_url}
                    alt={`Kartu nama ${individual.full_name}`}
                    className="max-h-[80vh] w-full object-contain"
                  />
                </DialogContent>
              </Dialog>
            </>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
                <CreditCard className="size-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Belum ada kartu nama tersimpan.</p>
                <Button variant="outline" disabled={uploading} onClick={() => fileRef.current?.click()}>
                  <Upload className="size-4" /> {uploading ? "Mengunggah…" : "Upload Kartu Nama"}
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="riwayat" className="mt-4">
          <InteractionTimeline
            interactions={interactions}
            target={{ kind: "individual", id: individual.id, name: individual.full_name }}
          />
        </TabsContent>
      </Tabs>

      <IndividualEditDialog open={editOpen} onOpenChange={setEditOpen} individual={individual} />
      <AffiliationFormDialog open={affOpen} onOpenChange={setAffOpen} individualId={individual.id} />
    </div>
  );
}
