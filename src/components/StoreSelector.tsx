import { useStore } from "@/contexts/StoreContext";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Store } from "lucide-react";

export function StoreSelector() {
  const { currentStore, stores, setCurrentStore } = useStore();

  if (stores.length <= 1) {
    return null;
  }

  return (
    <div className="flex items-center gap-2">
      <Store className="h-4 w-4 text-muted-foreground" />
      <Select
        value={currentStore?.id}
        onValueChange={(value) => {
          const store = stores.find((s) => s.id === value);
          if (store) setCurrentStore(store);
        }}
      >
        <SelectTrigger className="w-[250px]">
          <SelectValue placeholder="Selecione uma loja" />
        </SelectTrigger>
        <SelectContent>
          {stores.map((store) => (
            <SelectItem key={store.id} value={store.id}>
              {store.nome}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
