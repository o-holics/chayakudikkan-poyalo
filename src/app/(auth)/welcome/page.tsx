"use client";

import Link from "next/link";
import { Screen, Stack, Title, QuietText, Button, BottomAction } from "@/components/ui";
import { Doodle } from "@/components/Doodle";

export default function WelcomePage() {
  return (
    <Screen>
      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <Doodle name="cup" size={116} className="rise-slow text-ink" />
        <Stack gap={4} className="rise rise-delay mt-10 items-center">
          <Title>
            chai tastes better
            <br />
            with company
          </Title>
          <QuietText className="max-w-[19rem]">
            Pick a tea shop nearby. We&apos;ll quietly sit you with a few others who feel like a cup too.
          </QuietText>
        </Stack>
      </div>
      <BottomAction>
        <Link href="/sign-in" className="block">
          <Button full>begin</Button>
        </Link>
      </BottomAction>
    </Screen>
  );
}
