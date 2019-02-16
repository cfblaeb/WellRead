from tkinter import Tk, N, W, E, S, StringVar
from tkinter.ttk import Button, Entry, Frame, Label


def calculate(anarg):
	print(anarg)
	try:
		value = float(feet.get())
		meters.set((0.3048 * value * 10000.0 + 0.5)/10000.0)
	except ValueError:
		pass


root = Tk()
root.title("Feet to Meters")

mainframe = Frame(root, padding="3 3 12 12")
mainframe.grid(column=0, row=0, sticky=(N, W, E, S))
root.columnconfigure(0, weight=1)
root.rowconfigure(0, weight=1)

feet = StringVar()
meters = StringVar()

feet_entry = Entry(mainframe, width=7, textvariable=feet)
feet_entry.grid(column=2, row=1, sticky=(W, E))

Label(mainframe, textvariable=meters).grid(column=2, row=2, sticky=(W, E))
Button(mainframe, text="Calc", command=calculate).grid(column=3, row=3, sticky=W)

Label(mainframe, text="feet").grid(column=3, row=1, sticky=W)
Label(mainframe, text="is").grid(column=1, row=2, sticky=E)
Label(mainframe, text="meters").grid(column=5, row=2, sticky=W)

for child in mainframe.winfo_children():
	child.grid_configure(padx=5, pady=5)

feet_entry.focus()
root.bind('<Return>', calculate)

root.mainloop()
