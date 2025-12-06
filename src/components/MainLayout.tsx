import { Link, Outlet } from "react-router";
import { Home } from "lucide-react";
import { Button } from "./ui/button";
import { ThemeToggle } from "./ThemeToggle";
import { useSidecarBootstrap } from "@/hooks/useSidecarBootstrap";
import { useState } from "react";
import { SidecarSettings } from "./SidecarSettings";

export function MainLayout() {
    const sidecar = useSidecarBootstrap();
    const [persisting, setPersisting] = useState(false);

    const persistSidecarSettings = async (_cfg: { backend: string; stubEmbeddings: boolean }) => {
        // Env-driven today; guide the user.
        setPersisting(true);
        try {
            console.info("Update MEMORI_SIDECAR_BACKEND / MEMORI_SIDECAR_STUB_EMBEDDINGS in your env, then restart the sidecar.");
        } finally {
            setPersisting(false);
        }
    };
    return (
        <div className="min-h-screen flex bg-background">
            {/* Fixed Icon Navigation */}
            <div className="w-12 border-r bg-muted/50 flex flex-col items-center py-4 fixed h-screen" data-testid="main-sidebar">
                {/* Top Navigation Icons */}
                <div className="flex-1 flex flex-col space-y-4">
                    <Link to="/" data-testid="nav-home-link">
                        <Button
                            id="nav-home-button"
                            data-testid="nav-home-button"
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 hover:bg-accent hover:text-accent-foreground"
                            aria-label="Home"
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
                <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/30" data-testid="main-header">
                    <div className="text-sm text-muted-foreground" data-testid="sidecar-status">
                        {sidecar.ready ? (
                            <span data-testid="sidecar-connected">
                                Sidecar: {sidecar.backend} | LLM: {sidecar.llmProvider} ({sidecar.llmModel})
                            </span>
                        ) : (
                            <span data-testid="sidecar-unavailable">Sidecar: {'message' in sidecar ? sidecar.message : 'Unavailable'}</span>
                        )}
                    </div>
                    <div className="max-w-md">
                        <SidecarSettings
                            backend={sidecar.ready ? sidecar.backend : undefined}
                            llmProvider={sidecar.ready ? sidecar.llmProvider : undefined}
                            llmModel={sidecar.ready ? sidecar.llmModel : undefined}
                            onPersist={persistSidecarSettings}
                        />
                    </div>
                </div>
                <Outlet />
            </div>
        </div>
    );
}
