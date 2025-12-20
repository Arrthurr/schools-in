"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertTriangle,
  Settings,
} from "lucide-react";

interface School {
  id: string;
  name: string;
  address: string;
  latitude?: number;
  longitude?: number;
  radius?: number;
  description?: string;
  isActive: boolean;
  assignedProviders?: string[];
  contactEmail?: string;
  contactPhone?: string;
}

interface BulkOperationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedSchools: Set<string>;
  schools: School[];
  onSchoolsUpdated: (updatedSchools: School[]) => void;
  onClearSelection: () => void;
}

export function BulkOperationsModal({
  isOpen,
  onClose,
  selectedSchools,
}: BulkOperationsModalProps) {
  const [error, setError] = useState<string | null>(null);

  const handleClose = () => {
    setError(null);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <Settings className="h-5 w-5 mr-2" />
            Bulk Operations
          </DialogTitle>
          <DialogDescription>
            Perform operations on {selectedSchools.size} selected schools
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            This feature is under development. Basic bulk operations are
            available in the schools table.
          </p>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
