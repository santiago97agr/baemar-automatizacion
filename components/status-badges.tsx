import { Badge } from "@/components/ui/badge";

export function ReviewStatusBadge({ status }: { status: string }) {
  switch (status) {
    case "pending":
      return (
        <Badge variant="warning" dot>
          Pendiente
        </Badge>
      );
    case "reviewed":
      return (
        <Badge variant="success" dot>
          Revisado
        </Badge>
      );
    case "not_required":
      return (
        <Badge variant="neutral" dot>
          No requiere
        </Badge>
      );
    default:
      return <Badge variant="neutral">{status}</Badge>;
  }
}

export function PriorityBadge({ priority }: { priority: string }) {
  switch (priority) {
    case "Urgente":
      return (
        <Badge variant="danger" dot>
          Urgente
        </Badge>
      );
    case "Alta":
      return (
        <Badge variant="warning" dot>
          Alta
        </Badge>
      );
    case "Normal":
      return <Badge variant="neutral">Normal</Badge>;
    default:
      return <Badge variant="neutral">{priority}</Badge>;
  }
}

export function TargetStatusBadge({ status }: { status: string }) {
  switch (status) {
    case "ok":
      return (
        <Badge variant="success" dot>
          Correcto
        </Badge>
      );
    case "pending":
      return (
        <Badge variant="warning" dot>
          Pendiente
        </Badge>
      );
    case "error":
      return (
        <Badge variant="danger" dot>
          Error
        </Badge>
      );
    default:
      return <Badge variant="neutral">{status}</Badge>;
  }
}

export function CategoryBadge({ category }: { category: string }) {
  return <Badge variant="neutral">{category}</Badge>;
}
