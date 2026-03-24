import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronRight, CheckCircle2, XCircle, Clock } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface ChecklistCardProps {
  id: string;
  nome: string;
  area: string;
  turno: string;
  completionStatus?: {
    total: number;
    ok: number;
    nok: number;
    pendente: number;
    completed: boolean;
  };
}

const areaColors = {
  loja: "bg-primary text-primary-foreground",
  cozinha: "bg-secondary text-secondary-foreground",
  bar: "bg-accent text-accent-foreground",
};

const turnoLabels = {
  abertura: "Abertura",
  fechamento: "Fechamento",
};

export const ChecklistCard = ({
  id,
  nome,
  area,
  turno,
  completionStatus,
}: ChecklistCardProps) => {
  const navigate = useNavigate();

  const getProgressPercentage = () => {
    if (!completionStatus) return 0;
    const { total, ok } = completionStatus;
    return total > 0 ? (ok / total) * 100 : 0;
  };

  const getStatusColor = () => {
    if (!completionStatus) return "bg-muted";
    const { nok, pendente } = completionStatus;
    if (nok > 0) return "bg-destructive";
    if (pendente > 0) return "bg-warning";
    return "bg-success";
  };

  return (
    <Card className="group hover:shadow-lg transition-all duration-300 cursor-pointer border-2 hover:border-primary/50">
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2 flex-1">
            <CardTitle className="text-xl">{nome}</CardTitle>
            <div className="flex gap-2 flex-wrap">
              <Badge className={areaColors[area as keyof typeof areaColors]}>
                {area.charAt(0).toUpperCase() + area.slice(1)}
              </Badge>
              <Badge variant="outline">
                {turnoLabels[turno as keyof typeof turnoLabels]}
              </Badge>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(`/checklist/${id}`)}
            className="shrink-0"
          >
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {completionStatus && (
          <>
            <div className="space-y-2">
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Progresso</span>
                <span>{Math.round(getProgressPercentage())}%</span>
              </div>
              <div className="w-full bg-muted rounded-full h-2.5 overflow-hidden">
                <div
                  className={`h-full transition-all duration-500 ${getStatusColor()}`}
                  style={{ width: `${getProgressPercentage()}%` }}
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 text-sm">
              <div className="flex items-center gap-1.5 text-success">
                <CheckCircle2 className="h-4 w-4" />
                <span className="font-medium">{completionStatus.ok}</span>
              </div>
              <div className="flex items-center gap-1.5 text-destructive">
                <XCircle className="h-4 w-4" />
                <span className="font-medium">{completionStatus.nok}</span>
              </div>
              <div className="flex items-center gap-1.5 text-warning">
                <Clock className="h-4 w-4" />
                <span className="font-medium">{completionStatus.pendente}</span>
              </div>
            </div>

            {completionStatus.completed && (
              <Badge className="w-full justify-center bg-success">
                Checklist Completo
              </Badge>
            )}
          </>
        )}

        <Button
          className="w-full"
          onClick={() => navigate(`/checklist/${id}`)}
          variant={completionStatus?.completed ? "outline" : "default"}
        >
          {completionStatus?.completed ? "Visualizar" : "Preencher Checklist"}
        </Button>
      </CardContent>
    </Card>
  );
};
