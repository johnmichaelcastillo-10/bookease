import { RouterProvider } from 'react-router/dom'
import { ThemeProvider } from '@/app/providers/ThemeProvider'
import { createAppRouter } from '@/app/router/routes'
import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'

// Created once, outside React, as React Router recommends for data routers.
const router = createAppRouter()

export default function App() {
  return (
    <ThemeProvider>
      <TooltipProvider delayDuration={300}>
        <RouterProvider router={router} />
        <Toaster position="bottom-right" closeButton />
      </TooltipProvider>
    </ThemeProvider>
  )
}
