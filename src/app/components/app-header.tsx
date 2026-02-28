import logoImg from "figma:asset/18be1bb9126bc20903a4f39ba3a8f5fa468b188c.png";

export function AppHeader({ title }: { title?: string }) {
  return (
    <header className="sticky top-0 bg-[#152a6b] text-white z-40">
      <div className="max-w-lg mx-auto flex items-center gap-3 px-4 h-14">
        <img
          src={logoImg}
          alt="ECODIS Logo"
          className="h-9 w-auto object-contain rounded bg-white/90 px-1"
        />
        <div className="flex-1">
          {title ? (
            <h1 className="text-[15px] text-white tracking-wide">{title}</h1>
          ) : (
            <>
              <h1 className="text-[15px] text-white tracking-wide font-bold">
                ECO<span className="text-[#9b1b30]">DIS</span>
              </h1>
              <p className="text-[10px] text-white/70 -mt-0.5">
                Ecole des Disciples
              </p>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
