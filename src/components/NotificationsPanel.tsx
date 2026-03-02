import React, { useEffect, useMemo, useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { getNotifications } from "@/lib/api";
import { useAuth } from "@/hooks/useAuth";

interface NotificationItem {
  id: string;
  title: string;
  description: string;
  createdAt: string;
  type: string;
}

const NotificationsPanel: React.FC = () => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [open, setOpen] = useState<boolean>(false);
  const [readIds, setReadIds] = useState<string[]>([]);

  const storageKey = useMemo(
    () => `notifications-read-${user?.id || "guest"}`,
    [user?.id]
  );

  useEffect(() => {
    const stored = localStorage.getItem(storageKey);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setReadIds(parsed);
        }
      } catch (_error) {
        setReadIds([]);
      }
    } else {
      setReadIds([]);
    }
  }, [storageKey]);

  useEffect(() => {
    const loadNotifications = async () => {
      try {
        const response = await getNotifications();
        setNotifications(Array.isArray(response.data) ? response.data : []);
      } catch (error) {
        console.error("Error loading notifications:", error);
        setNotifications([]);
      }
    };

    if (user) {
      loadNotifications();
    } else {
      setNotifications([]);
    }
  }, [user]);

  const markRead = (id: string) => {
    setReadIds((prev) => {
      if (prev.includes(id)) {
        return prev;
      }
      const next = [...prev, id];
      localStorage.setItem(storageKey, JSON.stringify(next));
      return next;
    });
  };

  const markAllAsRead = () => {
    const allIds = notifications.map((item) => item.id);
    setReadIds(allIds);
    localStorage.setItem(storageKey, JSON.stringify(allIds));
  };

  const unreadCount = notifications.filter((item) => !readIds.includes(item.id)).length;

  const formatDate = (value: string): string => {
    return new Date(value).toLocaleDateString("ru-RU", {
      day: "numeric",
      month: "short"
    });
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="Уведомления">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-4 w-4 p-0 flex items-center justify-center"
            >
              {unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between p-4 bg-muted/20">
          <h3 className="font-medium">Уведомления</h3>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" onClick={markAllAsRead} className="text-xs">
              Отметить все как прочитанные
            </Button>
          )}
        </div>

        <Separator />

        <ScrollArea className="h-80">
          {notifications.length > 0 ? (
            notifications.map((item) => {
              const isRead = readIds.includes(item.id);
              return (
                <Card key={item.id} className={`border-0 rounded-none ${!isRead ? "bg-muted/10" : ""}`}>
                  <CardContent
                    className="p-4 hover:bg-muted/30 cursor-pointer"
                    onClick={() => markRead(item.id)}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-medium text-sm">{item.title}</h4>
                        <p className="text-sm text-muted-foreground mt-1">{item.description}</p>
                      </div>
                      <Badge variant="outline" className="text-xs font-normal">
                        {formatDate(item.createdAt)}
                      </Badge>
                    </div>

                    {!isRead && (
                      <div className="mt-2 flex justify-end">
                        <div className="h-2 w-2 bg-primary rounded-full"></div>
                      </div>
                    )}
                  </CardContent>
                  <Separator />
                </Card>
              );
            })
          ) : (
            <div className="p-4 text-center text-muted-foreground">Нет новых уведомлений</div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
};

export default NotificationsPanel;
