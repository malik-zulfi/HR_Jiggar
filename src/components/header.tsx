import { Bot } from "lucide-react";

export function Header() {
  return (
    <header className="p-4 border-b bg-card">
      <div className="container mx-auto flex items-center gap-3">
        <div className="p-2 bg-primary/10 rounded-lg">
          <Bot className="w-6 h-6 text-primary" />
        </div>
        <h1 className="text-xl font-bold text-foreground">Jiggar Assessment</h1>
      </div>
    </header>
  );
}
