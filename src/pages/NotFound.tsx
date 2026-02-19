import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import { Film, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-cinema-gradient px-4">
      <div className="text-center">
        <div className="mb-8 flex justify-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-muted">
            <Film className="h-10 w-10 text-muted-foreground" />
          </div>
        </div>
        <h1 className="mb-2 font-display text-6xl font-bold text-gradient-gold">404</h1>
        <p className="mb-8 text-xl text-muted-foreground">Cena não encontrada</p>
        <Button variant="cinema" size="lg" asChild>
          <a href="/" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Voltar ao Dashboard
          </a>
        </Button>
      </div>
    </div>
  );
};

export default NotFound;
