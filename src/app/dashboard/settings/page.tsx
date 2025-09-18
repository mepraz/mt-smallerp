
"use client";

import * as React from "react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getSettings, updateSettings } from "@/lib/data";
import { useToast } from "@/hooks/use-toast";
import type { SchoolSettings } from "@/lib/types";
import { Loader2, Save } from "lucide-react";
import { useRouter } from "next/navigation";

export default function SettingsPage() {
  const { toast } = useToast();
  const router = useRouter();
  const [settings, setSettings] = React.useState<SchoolSettings | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);

  React.useEffect(() => {
    getSettings().then(setSettings);
  }, []);

  async function handleSaveSettings(formData: FormData) {
    setIsLoading(true);
    try {
      await updateSettings(formData);
      toast({ title: "Success", description: "Settings updated successfully." });
      router.refresh();
      window.location.reload();
    } catch (error) {
      console.error(error);
      toast({ variant: "destructive", title: "Error", description: "Failed to update settings." });
    } finally {
      setIsLoading(false);
    }
  }

  if (settings === null) {
      return (
        <div className="flex h-full w-full items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )
  }

  return (
    <div>
      <PageHeader title="School Settings" />
      <Card>
        <CardHeader>
          <CardTitle>General Information</CardTitle>
          <CardDescription>Update your school's general information.</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={handleSaveSettings} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                    <Label htmlFor="schoolName">School Name</Label>
                    <Input 
                        id="schoolName" 
                        name="schoolName" 
                        defaultValue={settings.schoolName}
                        placeholder="e.g., Edify International School"
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="schoolPhone">School Phone</Label>
                    <Input 
                        id="schoolPhone" 
                        name="schoolPhone" 
                        defaultValue={settings.schoolPhone}
                        placeholder="e.g., +977 1 1234567"
                    />
                </div>
            </div>
            <div className="space-y-2">
                <Label htmlFor="schoolAddress">School Address</Label>
                <Input 
                    id="schoolAddress" 
                    name="schoolAddress" 
                    defaultValue={settings.schoolAddress}
                    placeholder="e.g., Kathmandu, Nepal"
                />
            </div>
            <div className="flex justify-end">
              <Button type="submit" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <Save className="mr-2 h-4 w-4" />
                Save Settings
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
