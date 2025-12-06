import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default function AdvancedGuide() {
    return (
        <div className="space-y-8">
            <div>
                <h2 className="text-2xl font-bold mb-4">Advanced Features Guide</h2>
                <p className="text-muted-foreground mb-6">
                    Learn about the advanced features of The Story Nexus to take your writing to the next level.
                </p>
            </div>

            <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Coming Soon</AlertTitle>
                <AlertDescription>
                    The advanced features guide is currently under development. Check back soon for detailed information on advanced writing techniques, AI customization, and more.
                </AlertDescription>
            </Alert>

            <div className="space-y-6">
                <section>
                    <h3 className="text-xl font-semibold mb-2">Sidecar Configuration</h3>
                    <p className="mb-4">
                        The <strong>Sidecar Settings</strong> panel (visible in the top navigation bar) displays the current status of your AI connection.
                    </p>
                    <Alert className="mb-4 bg-muted">
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>Informational Only</AlertTitle>
                        <AlertDescription>
                            The settings shown in the panel are currently read-only. Changing values in the dropdowns will not automatically update your configuration.
                        </AlertDescription>
                    </Alert>

                    <h4 className="text-lg font-medium mb-2">How to Change Settings</h4>
                    <p className="mb-2">
                        To modify the sidecar configuration (e.g., to switch backends or enable semantic search), you must edit the <code>.env</code> file in your project root directory and restart the application.
                    </p>
                    <ul className="list-disc list-inside space-y-2 ml-4 text-muted-foreground bg-muted/30 p-4 rounded-md font-mono text-sm">
                        <li>
                            <span className="font-semibold text-foreground">MEMORI_SIDECAR_BACKEND</span>: Set to <code>memori</code> for semantic features, or <code>sqlite</code> for basic keyword search.
                        </li>
                        <li>
                            <span className="font-semibold text-foreground">MEMORI_SIDECAR_STUB_EMBEDDINGS</span>: Set to <code>true</code> to disable expensive embedding generation (faster, but no semantic search). Set to <code>false</code> to enable semantic search.
                        </li>
                    </ul>
                </section>

                <div className="border-t pt-6">
                    <h3 className="text-xl font-semibold mb-2">Other Advanced Topics</h3>
                    <ul className="list-disc list-inside space-y-2 ml-4 text-muted-foreground">
                        <li>Advanced editor features and keyboard shortcuts</li>
                        <li>Customizing the writing experience</li>
                        <li>Managing multiple stories and chapters effectively</li>
                        <li>Organizing your writing workflow</li>
                        <li>Advanced AI generation techniques</li>
                        <li>Exporting and sharing your stories</li>
                    </ul>
                </div>
            </div>
        </div>
    );
} 