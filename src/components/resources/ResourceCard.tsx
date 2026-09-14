import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Archive,
  Copy,
  ExternalLink,
  FileText,
  FolderInput,
  Image as ImageIcon,
  MoreVertical,
  Pencil,
  Pin,
  Undo2,
} from "lucide-react";
import {
  CATEGORY_CLASS,
  faviconOf,
  hostOf,
  isExternalService,
  isImageResource,
  isPdfResource,
  openResource,
  rLabel,
  setResourceArchived,
  updateResource,
  type Resource,
} from "@/lib/resources";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const NONE = "__none__";

/** Kartu satu item (alat kerja atau aset). */
export function ResourceCard({
  resource,
  clicks = 0,
  canManage,
  folders,
  onEdit,
}: {
  resource: Resource;
  clicks?: number;
  canManage: boolean;
  folders: Resource[];
  onEdit: (r: Resource) => void;
}) {
  const queryClient = useQueryClient();
  const [moveOpen, setMoveOpen] = useState(false);
  const [target, setTarget] = useState(resource.folder_id ?? NONE);
  const [imgError, setImgError] = useState(false);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["resources"] });

  const open = useMutation({
    mutationFn: () => openResource(resource),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["resource-popularity"] }),
  });

  const move = useMutation({
    mutationFn: () => updateResource(resource.id, { folder_id: target === NONE ? null : target }),
    onSuccess: () => {
      invalidate();
      setMoveOpen(false);
      toast.success("Item dipindahkan.");
    },
    onError: (e: Error) => toast.error("Gagal memindahkan: " + e.message),
  });

  const archive = useMutation({
    mutationFn: (val: boolean) => setResourceArchived(resource.id, val),
    onSuccess: () => {
      invalidate();
      toast.success("Status arsip diperbarui.");
    },
    onError: (e: Error) => toast.error("Gagal: " + e.message),
  });

  const isAsset = resource.kind === "Aset";
  const showImage = isAsset && isImageResource(resource.url) && !imgError;
  const favicon = faviconOf(resource.url, resource.icon_url);

  async function copyLink() {
    if (!resource.url) return;
    try {
      await navigator.clipboard.writeText(resource.url);
      toast.success("Link disalin.");
    } catch {
      toast.error("Gagal menyalin link.");
    }
  }

  return (
    <div
      className={`relative flex flex-col gap-2 rounded-xl border bg-card p-3 shadow-sm ${
        resource.is_archived ? "opacity-50" : ""
      }`}
    >
      {clicks > 0 && (
        <span className="absolute right-10 top-3 rounded-full border bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
          {clicks} klik
        </span>
      )}

      <div className="flex items-start gap-2">
        {showImage ? (
          <img
            src={resource.url ?? ""}
            alt={resource.title}
            onError={() => setImgError(true)}
            className="size-14 rounded-lg border object-cover"
          />
        ) : isAsset && isPdfResource(resource.url) ? (
          <span className="flex size-10 items-center justify-center rounded-lg border bg-muted">
            <FileText className="size-5 text-muted-foreground" />
          </span>
        ) : favicon ? (
          <img src={favicon} alt="" className="size-8 rounded" />
        ) : (
          <span className="flex size-10 items-center justify-center rounded-lg border bg-muted">
            <ImageIcon className="size-5 text-muted-foreground" />
          </span>
        )}

        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1 truncate text-sm font-semibold">
            {resource.is_pinned && <Pin className="size-3 shrink-0 text-primary" />}
            {resource.title}
          </p>
          {resource.description && (
            <p className="truncate text-xs text-muted-foreground">{resource.description}</p>
          )}
          {!resource.description && hostOf(resource.url) && (
            <p className="truncate text-xs text-muted-foreground">{hostOf(resource.url)}</p>
          )}
        </div>

        {canManage && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="size-8" aria-label="Aksi lainnya">
                <MoreVertical className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => onEdit(resource)}>
                <Pencil className="size-4" /> Edit
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setMoveOpen(true)}>
                <FolderInput className="size-4" /> Pindah Folder
              </DropdownMenuItem>
              {resource.is_archived ? (
                <DropdownMenuItem onSelect={() => archive.mutate(false)}>
                  <Undo2 className="size-4" /> Pulihkan
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem
                  className="text-muted-foreground"
                  onSelect={() => archive.mutate(true)}
                >
                  <Archive className="size-4" /> Arsipkan
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {isAsset && (
        <div className="flex flex-wrap items-center gap-1.5">
          {resource.asset_category && (
            <span
              className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                CATEGORY_CLASS[resource.asset_category] ?? ""
              }`}
            >
              {rLabel(resource.asset_category)}
            </span>
          )}
          {isExternalService(resource.url) && (
            <span className="rounded-full border bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
              Eksternal
            </span>
          )}
          {(resource.tags ?? []).map((t) => (
            <span key={t} className="rounded-full border px-2 py-0.5 text-[10px] text-muted-foreground">
              #{t}
            </span>
          ))}
        </div>
      )}

      <div className="mt-auto flex gap-2">
        <Button size="sm" className="flex-1" onClick={() => open.mutate()}>
          <ExternalLink className="size-4" /> Buka
        </Button>
        {isAsset && (
          <Button size="sm" variant="outline" onClick={copyLink} aria-label="Salin link">
            <Copy className="size-4" /> Salin Link
          </Button>
        )}
      </div>

      <Dialog open={moveOpen} onOpenChange={setMoveOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Pindah Folder</DialogTitle>
          </DialogHeader>
          <Select value={target} onValueChange={setTarget}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>Tanpa folder</SelectItem>
              {folders
                .filter((f) => f.kind === resource.kind)
                .map((f) => (
                  <SelectItem key={f.id} value={f.id}>{f.title}</SelectItem>
                ))}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button onClick={() => move.mutate()} disabled={move.isPending}>Pindahkan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
