import { Link, Outlet } from "react-router";
import { Home, Info } from "lucide-react";
import { Button } from "./ui/button";
import { ThemeToggle } from "./ThemeToggle";
import { useSidecarBootstrap } from "@/hooks/useSidecarBootstrap";

export function MainLayout() {
    const sidecar = useSidecarBootstrap();
    return (
        <div className="min-h-screen flex bg-background">
            {/* Fixed Icon Navigation */}
            <div className="w-12 border-r bg-muted/50 flex flex-col items-center py-4 fixed h-screen">
                {/* Top Navigation Icons */}
                <div className="flex-1 flex flex-col space-y-4">
                    <Link to="/">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 hover:bg-accent hover:text-accent-foreground"
                        >
                            <Home className="h-5 w-5" />
                        </Button>
                    </Link>
                </div>

                {/* Theme Toggle at Bottom */}
                <div className="pb-4">
                    <ThemeToggle />
                </div>
            </div>

            {/* Main Content Area - with offset for fixed sidebar */}
            <div className="flex-1 ml-12">
                <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/30">
                    <div className="text-sm text-muted-foreground">
                        {sidecar.ready ? (
                            <span>
                                Sidecar: {sidecar.backend} · LLM: {sidecar.llmProvider} ({sidecar.llmModel})
                            </span>
                        ) : (
                            <span>Sidecar: {sidecar.message}</span>
                        )}
                    </div>
                </div>
                <Outlet />
            </div>
        </div>
    );
}
